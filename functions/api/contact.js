import { handleOptions, jsonReply, methodNotAllowed } from "../_lib/dashboard-api.js";

const FORMSPREE_ENDPOINT = "https://formspree.io/f/mblbnwoy";
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPT_EXT = new Set(["csv", "doc", "docx", "pdf", "txt", "xls", "xlsx", "jpg", "jpeg", "png", "gif", "svg", "webp"]);
const RECEIPT_TTL_SECONDS = 60 * 60 * 24 * 90;

function buildReceiptId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `receipt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeOptionalUrl(value) {
  const trimmed = normalizeText(value);
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
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
  if (!file || typeof file !== "object") return null;
  return {
    name: typeof file.name === "string" ? file.name : "",
    type: typeof file.type === "string" ? file.type : "",
    size: typeof file.size === "number" ? file.size : 0
  };
}

async function readUpstreamBody(response) {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    const text = await response.text();
    return text ? { raw: text } : null;
  } catch {
    return null;
  }
}

async function putReceipt(env, key, value) {
  if (!env?.SAVONIE_KV) {
    throw new Error("missing_receipt_store");
  }

  await env.SAVONIE_KV.put(key, JSON.stringify(value), {
    expirationTtl: RECEIPT_TTL_SECONDS
  });
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") return handleOptions(request);
  if (request.method !== "POST") return methodNotAllowed(request, ["POST", "OPTIONS"]);

  const receiptId = buildReceiptId();
  const receiptKey = `contact:receipt:${receiptId}`;

  try {
    const formData = await request.formData();
    const honeypot = normalizeText(formData.get("website_url"));
    if (honeypot) {
      return jsonReply(
        {
          success: false,
          error: "spam_detected",
          message: "Submission blocked by anti-spam protection."
        },
        400,
        request
      );
    }

    const name = normalizeText(formData.get("name"));
    const email = normalizeText(formData.get("email"));
    const message = normalizeText(formData.get("message"));
    const inquiryType = normalizeText(formData.get("inquiry-type"));
    const link = normalizeOptionalUrl(formData.get("link"));
    const file = formData.get("file");
    const fileMeta = extractFileMeta(file);

    if (!name || !email || !message) {
      return jsonReply(
        {
          success: false,
          error: "validation_failed",
          message: "Name, email, and message are required."
        },
        400,
        request
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonReply(
        {
          success: false,
          error: "validation_failed",
          message: "Please provide a valid email address."
        },
        400,
        request
      );
    }

    if (link && !isSafeUrl(link)) {
      return jsonReply(
        {
          success: false,
          error: "validation_failed",
          message: "Please provide a valid URL."
        },
        400,
        request
      );
    }

    if (fileMeta && fileMeta.size > 0) {
      const ext = (fileMeta.name.split(".").pop() || "").toLowerCase();
      if (!ACCEPT_EXT.has(ext)) {
        return jsonReply(
          {
            success: false,
            error: "validation_failed",
            message: "Unsupported attachment type."
          },
          400,
          request
        );
      }

      if (fileMeta.size > MAX_FILE_BYTES) {
        return jsonReply(
          {
            success: false,
            error: "validation_failed",
            message: "Attachment exceeds the 5MB limit."
          },
          400,
          request
        );
      }
    }

    const baseReceipt = {
      receiptId,
      state: "received",
      submittedAt: new Date().toISOString(),
      formId: "mblbnwoy",
      name,
      email,
      inquiryType,
      link,
      message,
      attachment: fileMeta,
      userAgent: request.headers.get("user-agent") || "",
      ip: request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || ""
    };

    await putReceipt(env, receiptKey, baseReceipt);

    const upstreamFormData = new FormData();
    upstreamFormData.set("name", name);
    upstreamFormData.set("email", email);
    upstreamFormData.set("message", message);
    if (inquiryType) upstreamFormData.set("inquiry-type", inquiryType);
    if (link) upstreamFormData.set("link", link);
    if (fileMeta && file instanceof File) {
      upstreamFormData.set("file", file, fileMeta.name || "attachment");
    }

    const upstreamResponse = await fetch(FORMSPREE_ENDPOINT, {
      method: "POST",
      headers: {
        Accept: "application/json"
      },
      body: upstreamFormData
    });

    const upstreamBody = await readUpstreamBody(upstreamResponse);
    const upstreamOk = upstreamResponse.ok
      && upstreamBody
      && upstreamBody.ok === true
      && typeof upstreamBody.next === "string";

    if (!upstreamOk) {
      try {
        await putReceipt(env, receiptKey, {
          ...baseReceipt,
          state: "upstream_failed",
          upstream: {
            endpoint: FORMSPREE_ENDPOINT,
            status: upstreamResponse.status,
            ok: upstreamResponse.ok,
            body: upstreamBody
          }
        });
      } catch {
        // Keep the original local receipt if enrichment fails.
      }

      const messageText = Array.isArray(upstreamBody?.errors)
        ? upstreamBody.errors.map((entry) => entry?.message).filter(Boolean).join(" ")
        : "Formspree did not confirm delivery for this submission.";

      return jsonReply(
        {
          success: false,
          error: "upstream_rejected",
          message: messageText,
          receiptId,
          recorded: true,
          upstream: {
            endpoint: FORMSPREE_ENDPOINT,
            status: upstreamResponse.status,
            ok: upstreamResponse.ok
          }
        },
        upstreamResponse.ok ? 502 : upstreamResponse.status,
        request
      );
    }

    try {
      await putReceipt(env, receiptKey, {
        ...baseReceipt,
        state: "forwarded",
        forwardedAt: new Date().toISOString(),
        upstream: {
          endpoint: FORMSPREE_ENDPOINT,
          status: upstreamResponse.status,
          ok: true,
          next: upstreamBody.next
        }
      });
    } catch {
      // The initial receipt is already stored; do not convert a delivered submission into a false failure.
    }

    return jsonReply(
      {
        success: true,
        recorded: true,
        receiptId,
        upstream: {
          endpoint: FORMSPREE_ENDPOINT,
          status: upstreamResponse.status,
          ok: true,
          next: upstreamBody.next
        }
      },
      200,
      request,
      {
        "X-Contact-Receipt-Id": receiptId
      }
    );
  } catch (error) {
    return jsonReply(
      {
        success: false,
        error: "internal_error",
        message: "Contact submission could not be completed."
      },
      500,
      request
    );
  }
}
