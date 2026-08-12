import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";

import chatWorker from "../worker/worker.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const moduleFixture = fs.mkdtempSync(path.join(os.tmpdir(), "portfolio-security-"));
const errorApiFixture = path.join(moduleFixture, "error-api.mjs");
const dashboardApiFixture = path.join(moduleFixture, "dashboard-api.mjs");
fs.writeFileSync(errorApiFixture, fs.readFileSync(path.join(ROOT, "worker", "error-api.js"), "utf8"));
const dashboardSource = fs.readFileSync(path.join(ROOT, "functions", "_lib", "dashboard-api.js"), "utf8")
  .replace('"../../worker/error-api.js"', JSON.stringify(pathToFileURL(errorApiFixture).href));
fs.writeFileSync(dashboardApiFixture, dashboardSource);
const { getCorsHeaders, handleHealth, handleOptions } = await import(pathToFileURL(dashboardApiFixture).href);

function fail(message) {
  throw new Error(message);
}
function expect(condition, label) {
  if (!condition) fail(label);
}

function expectHeader(headers, name, expected, label) {
  expect(headers.get(name) === expected, label);
}

async function expectJson(response, label) {
  expect(response instanceof Response, `${label}: response type`);
  return response.json();
}

async function runCase(label, test) {
  try {
    await test();
    console.log(`[PASS] ${label}`);
  } catch {
    failures.push(label);
    console.log(`[FAIL] ${label}`);
  }
}

function request(origin, method = "GET") {
  return new Request("https://api.example.test/api/health", {
    method,
    headers: origin ? { Origin: origin } : undefined,
  });
}

function isCredentialIdentifier(name) {
  const parts = name
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase());
  return parts.some((part) => ["password", "token", "secret", "key"].includes(part));
}

function hasPowerShellLiteralCredentialAssignment(source) {
  let blockComment = false;
  let hereStringEnd = null;

  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trimStart();
    if (hereStringEnd) {
      if (trimmed === hereStringEnd) hereStringEnd = null;
      continue;
    }
    if (blockComment) {
      if (trimmed.includes("#>")) blockComment = false;
      continue;
    }
    if (trimmed.startsWith("<#")) {
      blockComment = !trimmed.slice(2).includes("#>");
      continue;
    }
    if (trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("@'") || trimmed.startsWith('@"')) {
      hereStringEnd = trimmed.startsWith("@'") ? "'@" : '"@';
      continue;
    }

    const assignment = /^\s*\$(?:[A-Za-z_][A-Za-z0-9_]*:)?(?:\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))\s*=\s*(@?['"])/i.exec(line);
    const identifier = assignment?.[1] || assignment?.[2];
    if (identifier && isCredentialIdentifier(identifier)) return true;
    if (assignment?.[3]?.startsWith("@")) {
      hereStringEnd = assignment[3] === "@'" ? "'@" : '"@';
      continue;
    }
  }

  return false;
}

await runCase("Given dashboard script has no literal credential assignment, When source is inspected, Then it requires an environment variable", () => {
  const source = fs.readFileSync(path.join(ROOT, "worker", "test-api.ps1"), "utf8");
  const compoundIdentifier = ["$", "dashboard", "Password"].join("");
  const compoundAssignment = `${compoundIdentifier} = ${JSON.stringify(["fixture", "value"].join("-"))}`;
  expect(hasPowerShellLiteralCredentialAssignment(compoundAssignment), "compound credential identifier detection");
  expect(!hasPowerShellLiteralCredentialAssignment(`# ${compoundAssignment}`), "comment credential assignment false positive");
  expect(!hasPowerShellLiteralCredentialAssignment(`<#\n${compoundAssignment}\n#>`), "block comment credential assignment false positive");
  expect(!hasPowerShellLiteralCredentialAssignment(`@"\n${compoundAssignment}\n"@`), "here-string credential assignment false positive");
  expect(hasPowerShellLiteralCredentialAssignment(`${compoundIdentifier} = @'\nignored payload\n'@`), "credential here-string assignment detection");
  const documentationVariable = `${["$", "documentation", "Text"].join("")} = @'`;
  expect(!hasPowerShellLiteralCredentialAssignment(`${documentationVariable}\n${compoundAssignment}\n'@`), "here-string payload credential assignment false positive");
  expect(!hasPowerShellLiteralCredentialAssignment(source), "dashboard script literal assignment");
  expect(/\$env:DASHBOARD_PASSWORD\b/i.test(source), "dashboard script environment variable");
  expect(/if\s*\([^\n]*\$env:DASHBOARD_PASSWORD[^\n]*\)/i.test(source), "dashboard script fail-closed guard");
});

await runCase("Given Gemini integration source and an injected environment key, When transport is exercised, Then the key is forwarded only in x-goog-api-key", async () => {
  const source = fs.readFileSync(path.join(ROOT, "worker", "test-gemini.js"), "utf8");
  expect(/env\.GEMINI_API_KEY/.test(source), "Gemini environment key");
  expect(/["']x-goog-api-key["']\s*:/i.test(source), "Gemini header transport");
  expect(!/(?:[?&](?:key|api_key)\s*=|searchParams\.(?:append|set)\(\s*["'](?:key|api_key)["'])/i.test(source), "Gemini URL query key");

  const injectedApiKey = ["fixture", "gemini", "value?part/#"].join("-");
  const endpoint = "https://gemini.example.test/v1beta/models/test:generateContent";
  const capturedRequest = { url: null, headers: null, body: null };
  const vmContext = {
    process: { env: { GEMINI_API_KEY: injectedApiKey, GEMINI_ENDPOINT: endpoint } },
    fetch: async (url, options) => {
      capturedRequest.url = String(url);
      capturedRequest.headers = options?.headers || {};
      capturedRequest.body = options?.body || "";
      return { status: 200, ok: true };
    },
    console: { log() {}, error() {} },
    Headers,
  };
  const entrypoint = source.lastIndexOf("\nrun().catch(");
  expect(entrypoint > 0, "Gemini source entrypoint");
  const execution = vm.runInNewContext(`${source.slice(0, entrypoint)}\nrun()`, vmContext, { filename: path.join(ROOT, "worker", "test-gemini.js") });
  await execution;

  const headerEntries = typeof capturedRequest.headers?.entries === "function"
    ? [...capturedRequest.headers.entries()]
    : Object.entries(capturedRequest.headers || {});
  const markerHeaders = headerEntries.filter(([, value]) => String(value).includes(injectedApiKey));
  const headerValue = headerEntries.find(([name]) => name.toLowerCase() === "x-goog-api-key")?.[1];
  expect(headerValue === injectedApiKey, "Gemini header receives injected environment key");
  expect(markerHeaders.length === 1 && markerHeaders[0][0].toLowerCase() === "x-goog-api-key" && markerHeaders[0][1] === injectedApiKey, "Gemini marker appears only in exact header value");
  expect(!String(capturedRequest.body).includes(injectedApiKey), "Gemini request body excludes key marker");
  const requestUrl = new URL(String(capturedRequest.url));
  const decodedUrl = decodeURIComponent(requestUrl.href);
  expect(![requestUrl.href, requestUrl.pathname, requestUrl.search, requestUrl.hash, decodedUrl]
    .some((part) => part.includes(injectedApiKey) || part.includes(encodeURIComponent(injectedApiKey))), "Gemini request URL excludes key marker");
});

await runCase("Given the obsolete backup is removed, When tracked files are enumerated, Then no backup remains", () => {
  expect(!fs.existsSync(`${path.join(ROOT, "worker", "error-api.js")}.backup`), "obsolete backup present");
});

await runCase("Given the stale worker index is obsolete, When deployable files are enumerated, Then no duplicate entrypoint remains", () => {
  expect(!fs.existsSync(path.join(ROOT, "worker", "index.js")), "obsolete worker index present");
});

await runCase("Given a canonical production origin, When CORS headers are built, Then credentials and exact origin are returned", () => {
  const headers = new Headers(getCorsHeaders(request("https://www.estivanayramia.com"), {}));
  expectHeader(headers, "Access-Control-Allow-Origin", "https://www.estivanayramia.com", "canonical allow-origin");
  expectHeader(headers, "Access-Control-Allow-Credentials", "true", "canonical credentials");
});

await runCase("Given an exact configured origin, When CORS headers are built, Then it is allowed", () => {
  const origin = "https://dashboard.example.test";
  const headers = new Headers(getCorsHeaders(request(origin), { DASHBOARD_ALLOWED_ORIGINS: origin }));
  expectHeader(headers, "Access-Control-Allow-Origin", origin, "custom allow-origin");
  expectHeader(headers, "Access-Control-Allow-Credentials", "true", "custom credentials");
});

for (const origin of [
  "https://preview.pages.dev",
  "https://preview.workers.dev",
  "https://estivanayramia.com.attacker.example",
  "https://dashboard.example.test.evil",
]) {
  await runCase(`Given a denied origin, When CORS headers are built, Then no credentialed access is granted (${new URL(origin).hostname})`, () => {
    const headers = new Headers(getCorsHeaders(request(origin), { DASHBOARD_ALLOWED_ORIGINS: "https://dashboard.example.test" }));
    expect(!headers.has("Access-Control-Allow-Origin"), "denied allow-origin");
    expect(!headers.has("Access-Control-Allow-Credentials"), "denied credentials");
  });
}

await runCase("Given a malformed configured origin, When CORS headers are built, Then it is ignored", () => {
  const headers = new Headers(getCorsHeaders(request("https://dashboard.example.test"), {
    DASHBOARD_ALLOWED_ORIGINS: "not-an-origin, https://dashboard.example.test/path, https://dashboard.example.test",
  }));
  expectHeader(headers, "Access-Control-Allow-Origin", "https://dashboard.example.test", "valid exact custom origin");
  expectHeader(headers, "Access-Control-Allow-Credentials", "true", "valid exact custom credentials");
});

await runCase("Given an allowed custom preflight, When OPTIONS is handled, Then CORS preflight is complete", async () => {
  const origin = "https://dashboard.example.test";
  const response = await handleOptions(request(origin, "OPTIONS"), { DASHBOARD_ALLOWED_ORIGINS: origin });
  expect(response.status === 204, "allowed preflight status");
  expectHeader(response.headers, "Access-Control-Allow-Origin", origin, "allowed preflight origin");
  expectHeader(response.headers, "Access-Control-Allow-Credentials", "true", "allowed preflight credentials");
  expect(response.headers.get("Access-Control-Allow-Methods")?.includes("OPTIONS"), "allowed preflight methods");
});

await runCase("Given a denied preflight, When OPTIONS is handled, Then it fails without CORS permission", async () => {
  const response = await handleOptions(request("https://preview.pages.dev", "OPTIONS"), {});
  expect(response.status === 403, "denied preflight status");
  expect(!response.headers.has("Access-Control-Allow-Origin"), "denied preflight origin");
  expect(!response.headers.has("Access-Control-Allow-Credentials"), "denied preflight credentials");
});

await runCase("Given a public health request with all bindings present, When health is fetched, Then payload is status and version only", async () => {
  const health = await chatWorker.fetch(request(null), {
    GEMINI_API_KEY: "dummy",
    SAVONIE_KV: {},
    SITE_BASE_URL: "https://private.example.test",
  });
  const payload = await expectJson(health, "public health");
  assert.deepEqual(Object.keys(payload).sort(), ["status", "version"], "public health allowlist");
  expect(payload.status === "ok", "public health status");
  expect(typeof payload.version === "string" && payload.version.length > 0, "public health version");
});

await runCase("Given a dashboard health request, When health is fetched, Then no binding detail leaks", async () => {
  const response = await handleHealth({ request: request("https://www.estivanayramia.com"), env: {
    CF_PAGES_COMMIT_SHA: "abcdef123456",
    DASHBOARD_PASSWORD: "dummy",
    SAVONIE_KV: {},
    DB: { prepare: () => ({ all: async () => ({ results: [{ ok: 1 }] }) }) },
  } });
  const payload = await expectJson(response, "dashboard health");
  expect(!Object.hasOwn(payload, "kv"), "dashboard health kv detail");
  expect(!Object.hasOwn(payload, "d1Ok"), "dashboard health database detail");
  expect(!Object.hasOwn(payload, "authSource"), "dashboard health auth detail");
  expect(Object.hasOwn(payload, "status") && Object.hasOwn(payload, "version"), "dashboard health allowlist");
});

if (failures.length > 0) {
  console.error(`[SUMMARY] ${failures.length} security regression case(s) failed`);
  process.exitCode = 1;
} else {
  console.log("[SUMMARY] security regression suite passed");
}

fs.rmSync(moduleFixture, { recursive: true, force: true });
