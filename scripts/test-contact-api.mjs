import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { webcrypto } from "node:crypto";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const ROOT_DIR = resolve(fileURLToPath(new URL("../", import.meta.url)));
const CONTACT_SOURCE = resolve(ROOT_DIR, "functions/api/contact.js");
const RECEIPT_TTL_SECONDS = 60 * 60 * 24 * 30;
const RuntimeRequest = globalThis.Request;
const RuntimeResponse = globalThis.Response;
const RuntimeFormData = globalThis.FormData;
const RuntimeBlob = globalThis.Blob;
if (!RuntimeRequest || !RuntimeResponse || !RuntimeFormData || !RuntimeBlob) {
  throw new Error("Node 18+ Web API globals are required for this no-network harness.");
}
const RuntimeFile = globalThis.File || class TestFile extends RuntimeBlob {
  constructor(parts, name, options = {}) {
    super(parts, options);
    this.name = name;
    this.lastModified = options.lastModified || Date.now();
  }
};

function jsonReply(payload, status, _request, extraHeaders = {}) {
  return new RuntimeResponse(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...extraHeaders }
  });
}
function handleOptions() {
  return new RuntimeResponse(null, { status: 204 });
}

function methodNotAllowed(request, methods) {
  return jsonReply({ success: false, error: "method_not_allowed" }, 405, request, { Allow: methods.join(", ") });
}

function loadHandler() {
  const source = readFileSync(CONTACT_SOURCE, "utf8")
    .replace(/^import[^\n]+\r?\n/, "")
    .replace("export async function onRequest", "async function onRequest");
  const sandbox = {
    Array,
    Date,
    Error,
    FormData: RuntimeFormData,
    File: RuntimeFile,
    JSON,
    Map,
    Math,
    Number,
    Object,
    Promise,
    Request: RuntimeRequest,
    Response: RuntimeResponse,
    Set,
    String,
    TextEncoder,
    Uint8Array,
    URL,
    crypto: webcrypto,
    fetch: async () => { throw new Error("unexpected_network"); },
    handleOptions,
    jsonReply,
    methodNotAllowed
  };
  const context = vm.createContext(sandbox);
  const factory = `(() => { ${source}; return onRequest; })()`;
  return { handler: vm.runInContext(factory, context), sandbox };
}

function makeFormData({ fileName, fileType, message = "Hello from the API test." } = {}) {
  const form = new RuntimeFormData();
  form.set("subject", "Portfolio contact from test");
  form.set("name", "API Test");
  form.set("email", "api-test@example.com");
  form.set("message", message);
  form.set("inquiry-type", "general");
  form.set("link", "https://example.com/brief");
  if (fileName) form.set("file", new RuntimeFile(["attachment"], fileName, { type: fileType }), fileName);
  return form;
}

function makeRequest(form) {
  return new RuntimeRequest("https://portfolio.test/api/contact", {
    method: "POST",
    headers: { "cf-connecting-ip": "203.0.113.8" },
    body: form
  });
}

function makeStore({ count = null, unavailable = false } = {}) {
  const writes = [];
  return {
    writes,
    SAVONIE_KV: {
      async get(key) {
        if (unavailable) throw new Error("kv_get_failed");
        if (key.startsWith("contact:rate:") && count !== null) return { count };
        return null;
      },
      async put(key, value, options) {
        if (unavailable) throw new Error("kv_put_failed");
        writes.push({ key, value, options });
      }
    }
  };
}

async function invoke(handler, sandbox, request, env, upstream) {
  sandbox.fetch = upstream;
  return handler({ request, env });
}

async function testPreParseBodyCap(handler, sandbox) {
  const request = new RuntimeRequest("https://portfolio.test/api/contact", {
    method: "POST",
    headers: {
      "content-type": "multipart/form-data; boundary=too-large",
      "content-length": String(6 * 1024 * 1024 + 1)
    },
    body: "ignored"
  });
  let networkCalled = false;
  const response = await invoke(handler, sandbox, request, makeStore(), async () => {
    networkCalled = true;
    throw new Error("network_not_allowed");
  });
  assert.equal(response.status, 413);
  assert.equal(networkCalled, false);
}

async function testRateStates(handler, sandbox) {
  const form = makeFormData();
  const missing = await invoke(handler, sandbox, makeRequest(form), {}, async () => {
    throw new Error("network_not_allowed");
  });
  assert.equal(missing.status, 503);

  const unavailable = await invoke(handler, sandbox, makeRequest(makeFormData()), makeStore({ unavailable: true }), async () => {
    throw new Error("network_not_allowed");
  });
  assert.equal(unavailable.status, 503);

  const malformed = await invoke(handler, sandbox, makeRequest(makeFormData()), makeStore({ count: "bad" }), async () => {
    throw new Error("network_not_allowed");
  });
  assert.equal(malformed.status, 503);

  const limited = await invoke(handler, sandbox, makeRequest(makeFormData()), makeStore({ count: 5 }), async () => {
    throw new Error("network_not_allowed");
  });
  assert.equal(limited.status, 429);
}

async function testMimeAndExtensionValidation(handler, sandbox) {
  for (const [fileName, fileType] of [["payload.pdf", "text/plain"], ["payload.exe", "application/pdf"]]) {
    const response = await invoke(handler, sandbox, makeRequest(makeFormData({ fileName, fileType })), makeStore(), async () => {
      throw new Error("network_not_allowed");
    });
    assert.equal(response.status, 400);
  }
}

async function testReceiptMinimization(handler, sandbox) {
  const store = makeStore();
  let networkCalled = false;
  const upstream = async (_url, options) => {
    networkCalled = true;
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("message"), "Hello from the API test.");
    return new RuntimeResponse(JSON.stringify({ ok: true, next: "/thanks", errors: [] }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };
  const response = await invoke(handler, sandbox, makeRequest(makeFormData({ fileName: "brief.pdf", fileType: "application/pdf" })), store, upstream);
  assert.equal(response.status, 200);
  assert.equal(networkCalled, true);

  const receiptWrites = store.writes.filter((write) => write.key.startsWith("contact:receipt:"));
  assert.ok(receiptWrites.length >= 2);
  for (const write of receiptWrites) {
    assert.equal(write.options.expirationTtl, RECEIPT_TTL_SECONDS);
    const receipt = JSON.parse(write.value);
    assert.equal("ip" in receipt, false);
    assert.equal("userAgent" in receipt, false);
    assert.equal("message" in receipt, false);
    assert.equal("email" in receipt, false);
    assert.equal("body" in receipt, false);
    if (receipt.attachment) assert.deepEqual(receipt.attachment, { type: "application/pdf", size: 10 });
  }
  const rateWrite = store.writes.find((write) => write.key.startsWith("contact:rate:"));
  assert.ok(rateWrite);
  assert.equal(rateWrite.key.includes("203.0.113.8"), false);
}

const { handler, sandbox } = loadHandler();
await testPreParseBodyCap(handler, sandbox);
await testRateStates(handler, sandbox);
await testMimeAndExtensionValidation(handler, sandbox);
await testReceiptMinimization(handler, sandbox);
console.log("PASS: contact API contract matrix (no network)");
