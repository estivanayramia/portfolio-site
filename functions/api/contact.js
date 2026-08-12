import { handleOptions, jsonReply, methodNotAllowed } from "../_lib/dashboard-api.js";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mblbnwoy";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_BODY_BYTES = 6 * 1024 * 1024;
const ACCEPT_FILE_TYPES = new Map([
  ["csv", new Set(["text/csv", "application/csv"])],
  ["doc", new Set(["application/msword"])],
  ["docx", new Set(["application/vnd.openxmlformats-officedocument.wordprocessingml.document"])],
  ["pdf", new Set(["application/pdf"])],
  ["txt", new Set(["text/plain"])],
  ["xls", new Set(["application/vnd.ms-excel"])],
  ["xlsx", new Set(["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"])],
  ["jpg", new Set(["image/jpeg"])],
  ["jpeg", new Set(["image/jpeg"])],
  ["png", new Set(["image/png"])],
  ["gif", new Set(["image/gif"])],
  ["svg", new Set(["image/svg+xml"])],
  ["webp", new Set(["image/webp"])]
]);
const FIELD_LIMITS = new Map([
  ["subject", 120],
  ["name", 120],
  ["email", 254],
  ["message", 5000],
  ["inquiry-type", 80],
  ["link", 2048],
  ["website_url", 128]
]);
const RECEIPT_TTL_SECONDS = 60 * 60 * 24 * 30;
const RATE_LIMIT_WINDOW_SECONDS = 60 * 10;
const RATE_LIMIT_MAX = 5;

function buildReceiptId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readTextField(formData, name, maxLength) {
  const raw = formData.get(name);
  if (raw == null) return { value: "", valid: true };
  if (typeof raw !== "string") return { value: "", valid: false };
  const value = raw.trim();
  return { value, valid: value.length <= maxLength };
}

function normalizeOptionalUrl(value) {
  const trimmed = normalizeText(value);
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function normalizeSubjectPart(value) {
  return normalizeText(value).replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").slice(0, 120);
}

function buildSubject(name, inquiryType) {
  const sender = normalizeSubjectPart(name) || "website visitor";
  const type = normalizeSubjectPart(inquiryType);
  return type ? `Portfolio contact (${type}) from ${sender}` : `Portfolio contact from ${sender}`;
}

function isSafeUrl(value) {
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return !["javascript:", "data:", "file:", "blob:", "chrome:", "chrome-extension:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function extractFileMeta(file) {
  if (!file || typeof file !== "object" || typeof file.name !== "string") return null;
  return {
    name: file.name,
    type: typeof file.type === "string" ? file.type.toLowerCase() : "",
    size: typeof file.size === "number" ? file.size : 0
  };
}

function validateFile(file) {
  const fileMeta = extractFileMeta(file);
  if (!fileMeta || (!fileMeta.name && fileMeta.size === 0)) return { valid: true, meta: null };
  if (fileMeta.name.length > 255) return { valid: false, meta: fileMeta };
  const extension = (fileMeta.name.split(".").pop() || "").toLowerCase();
  const allowedMimes = ACCEPT_FILE_TYPES.get(extension);
  if (!allowedMimes || !allowedMimes.has(fileMeta.type)) return { valid: false, meta: fileMeta };
  if (fileMeta.size > MAX_FILE_BYTES) return { valid: false, meta: fileMeta };
  return { valid: true, meta: fileMeta };
}

async function parseBoundedForm(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (!contentType.startsWith("multipart/form-data")) return { error: "unsupported_media_type" };

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return { error: "payload_too_large" };

  const body = await readBoundedBody(request);
  if (body === null) return { error: "payload_too_large" };

  const parserRequest = new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body
  });
  return { formData: await parserRequest.formData() };
}

async function readBoundedBody(request) {
  const stream = request.clone().body;
  if (!stream) {
    const fallback = await request.clone().arrayBuffer();
    return fallback.byteLength > MAX_BODY_BYTES ? null : new Uint8Array(fallback);
  }
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const result = await reader.read();
    if (result.done) break;
    total += result.value.byteLength;
    if (total > MAX_BODY_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(result.value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function getClientIp(request) {
  const direct = normalizeText(request.headers.get("cf-connecting-ip"));
  if (direct) return direct;
  return normalizeText((request.headers.get("x-forwarded-for") || "").split(",")[0]);
}

async function hashClientIp(request) {
  const value = getClientIp(request) || "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeRateLimit(env, key) {
  if (!env?.SAVONIE_KV) return "unavailable";
  const rateKey = `contact:rate:${key}`;
  try {
    const rawCurrent = await env.SAVONIE_KV.get(rateKey, "json");
    const current = typeof rawCurrent === "string" ? JSON.parse(rawCurrent) : rawCurrent;
    if (current !== null && current !== undefined && (!current || !Number.isInteger(current.count) || current.count < 0)) {
      return "unavailable";
    }
    const count = current ? current.count : 0;
    if (count >= RATE_LIMIT_MAX) return "limited";
    await env.SAVONIE_KV.put(rateKey, JSON.stringify({ count: count + 1 }), {
      expirationTtl: RATE_LIMIT_WINDOW_SECONDS
    });
    return "allowed";
  } catch {
    return "unavailable";
  }
}

async function readUpstreamBody(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) return null;
  try {
    const body = await response.json();
    return body && typeof body === "object" && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

function isAllowedNext(nextValue, request) {
  if (typeof nextValue !== "string" || !nextValue.trim()) return false;
  try {
    const nextUrl = new URL(nextValue, request.url);
    if (nextUrl.username || nextUrl.password) return false;
    if (nextUrl.origin === new URL(request.url).origin) return true;
    return nextUrl.protocol === "https:" && /(^|\.)formspree\.io$/i.test(nextUrl.hostname);
  } catch {
    return false;
  }
}

function isSuccessfulUpstream(response, body, request) {
  if (!response || response.status < 200 || response.status >= 300) return false;
  if (!body || body.ok !== true || !isAllowedNext(body.next, request)) return false;
  if (Object.prototype.hasOwnProperty.call(body, "errors")) {
    if (!Array.isArray(body.errors) || body.errors.length > 0) return false;
  }
  return true;
}

async function putReceipt(env, key, value) {
  if (!env?.SAVONIE_KV) throw new Error("missing_receipt_store");
  await env.SAVONIE_KV.put(key, JSON.stringify(value), { expirationTtl: RECEIPT_TTL_SECONDS });
}

async function tryPutReceipt(env, key, value) {
  try {
    await putReceipt(env, key, value);
    return true;
  } catch {
    return false;
  }
}

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === "OPTIONS") return handleOptions(request, env);
  if (request.method !== "POST") return methodNotAllowed(request, ["POST", "OPTIONS"], env);

  const receiptId = buildReceiptId();
  const receiptKey = `contact:receipt:${receiptId}`;
  let baseReceipt = null;
  let receiptRecorded = false;

  try {
    const parsed = await parseBoundedForm(request);
    if (parsed.error === "payload_too_large") return jsonReply({ success: false, error: parsed.error }, 413, request);
    if (parsed.error) return jsonReply({ success: false, error: parsed.error }, 415, request);

    const formData = parsed.formData;
    const fieldValues = {};
    for (const [name, maxLength] of FIELD_LIMITS) {
      const field = readTextField(formData, name, maxLength);
      if (!field.valid) return jsonReply({ success: false, error: "validation_failed", message: "One or more fields are invalid or too long." }, 400, request);
      fieldValues[name] = field.value;
    }

    if (fieldValues.website_url) {
      return jsonReply({ success: false, error: "spam_detected", message: "Submission blocked by anti-spam protection." }, 400, request);
    }
    if (!fieldValues.name || !fieldValues.email || !fieldValues.message) {
      return jsonReply({ success: false, error: "validation_failed", message: "Name, email, and message are required." }, 400, request);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fieldValues.email)) {
      return jsonReply({ success: false, error: "validation_failed", message: "Please provide a valid email address." }, 400, request);
    }

    const link = normalizeOptionalUrl(fieldValues.link);
    if (link && !isSafeUrl(link)) return jsonReply({ success: false, error: "validation_failed", message: "Please provide a valid URL." }, 400, request);

    const file = formData.get("file");
    const fileResult = validateFile(file);
    if (!fileResult.valid) {
      const tooLarge = fileResult.meta && fileResult.meta.size > MAX_FILE_BYTES;
      return jsonReply({
        success: false,
        error: "validation_failed",
        message: tooLarge ? "Attachment exceeds the 5MB limit." : "Unsupported attachment type."
      }, 400, request);
    }

    const ipHash = await hashClientIp(request);
    const rateLimitState = await consumeRateLimit(env, ipHash);
    if (rateLimitState === "limited") {
      return jsonReply({ success: false, error: "rate_limited", message: "Please wait before sending another message." }, 429, request);
    }
    if (rateLimitState !== "allowed") {
      return jsonReply({ success: false, error: "rate_limit_unavailable", message: "Contact submissions are temporarily unavailable. Please try again later." }, 503, request);
    }

    const subject = buildSubject(fieldValues.name, fieldValues["inquiry-type"]);
    const submittedAt = new Date().toISOString();
    baseReceipt = {
      receiptId,
      state: "received",
      submittedAt,
      formId: "mblbnwoy",
      attachment: fileResult.meta ? { type: fileResult.meta.type, size: fileResult.meta.size } : null
    };
    receiptRecorded = await tryPutReceipt(env, receiptKey, baseReceipt);

    const upstreamFormData = new FormData();
    upstreamFormData.set("subject", subject);
    upstreamFormData.set("name", fieldValues.name);
    upstreamFormData.set("email", fieldValues.email);
    upstreamFormData.set("message", fieldValues.message);
    if (fieldValues["inquiry-type"]) upstreamFormData.set("inquiry-type", fieldValues["inquiry-type"]);
    if (link) upstreamFormData.set("link", link);
    if (fileResult.meta && typeof File !== "undefined" && file instanceof File) {
      upstreamFormData.set("file", file, fileResult.meta.name || "attachment");
    }

    const upstreamResponse = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: upstreamFormData
    });
    const upstreamBody = await readUpstreamBody(upstreamResponse);
    const upstreamOk = isSuccessfulUpstream(upstreamResponse, upstreamBody, request);

    if (!upstreamOk) {
      receiptRecorded = (await tryPutReceipt(env, receiptKey, {
        ...baseReceipt,
        state: "upstream_failed",
        upstream: { status: upstreamResponse.status, ok: upstreamResponse.ok }
      })) || receiptRecorded;
      const messageText = Array.isArray(upstreamBody?.errors)
        ? upstreamBody.errors.map((entry) => normalizeText(entry?.message)).filter(Boolean).slice(0, 2).join(" ")
        : "Formspree did not confirm delivery for this submission.";
      return jsonReply({
        success: false,
        error: "upstream_rejected",
        message: messageText,
        receiptId,
        recorded: receiptRecorded,
        upstream: { status: upstreamResponse.status, ok: upstreamResponse.ok }
      }, upstreamResponse.ok ? 502 : upstreamResponse.status, request);
    }

    receiptRecorded = (await tryPutReceipt(env, receiptKey, {
      ...baseReceipt,
      state: "forwarded",
      forwardedAt: new Date().toISOString(),
      upstream: { status: upstreamResponse.status, ok: true }
    })) || receiptRecorded;

    return jsonReply({
      success: true,
      recorded: receiptRecorded,
      receiptId,
      upstream: { status: upstreamResponse.status, ok: true }
    }, 200, request, { "X-Contact-Receipt-Id": receiptId });
  } catch {
    if (baseReceipt) {
      receiptRecorded = (await tryPutReceipt(env, receiptKey, {
        ...baseReceipt,
        state: "upstream_failed",
        upstream: { status: 0, ok: false }
      })) || receiptRecorded;
    }
    return jsonReply({
      success: false,
      error: "internal_error",
      message: "Contact submission could not be completed.",
      ...(baseReceipt ? { receiptId, recorded: receiptRecorded } : {})
    }, 500, request);
  }
}
