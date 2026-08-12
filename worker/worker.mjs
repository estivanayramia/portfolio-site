import {
  CHAT_VERSION,
  buildChips,
  buildModelContext,
  postProcessReply,
  prepareChatContext
} from "./chat-service.mjs";
import { buildHealthPayload } from "./health-payload.mjs";
import { cleanTextFragment, normalizeRoute } from "./chat-grounding-utils.mjs";
import {
  buildDebugPayload,
  getContinuationHint,
  getCurrentPath,
  safeTruncate,
  shouldBypassRateLimit
} from "./chat-runtime-helpers.mjs";

const GEMINI_TIMEOUT_MS = 25000;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REQUEST_BODY_BYTES = 32 * 1024;
const MAX_LANGUAGE_LENGTH = 16;
const MAX_HISTORY_ITEMS = 8;
const MAX_HISTORY_TEXT_LENGTH = 500;
const MAX_HISTORY_CARD_ID_LENGTH = 120;
const MAX_PAGE_CONTEXT_TEXT_LENGTH = 3500;
const MAX_PAGE_CONTEXT_HEADINGS = 10;
const MAX_PAGE_CONTEXT_HEADING_LENGTH = 160;
const MAX_REPLY_CHARS = 8000;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const RATE_LIMIT_MAX_KEYS = 1024;
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-pro";

const LOCAL_RATE_LIMITER = globalThis.__savonieRateLimiter || (globalThis.__savonieRateLimiter = new Map());

const CANONICAL_ORIGINS = new Set([
  "https://www.estivanayramia.com",
  "https://estivanayramia.com"
]);
const LOCAL_ORIGINS = new Set([
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:4173",
  "http://localhost:5500",
  "http://localhost:8787",
  "http://127.0.0.1",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5500",
  "http://127.0.0.1:8787",
  "http://[::1]",
  "http://[::1]:3000",
  "http://[::1]:4173",
  "http://[::1]:5500",
  "http://[::1]:8787"
]);

function getConfiguredOrigins(env) {
  const configured = new Set([...CANONICAL_ORIGINS, ...LOCAL_ORIGINS]);
  for (const value of [env?.SITE_BASE_URL, env?.CORS_ORIGIN, ...(String(env?.CORS_ORIGINS || "").split(","))]) {
    if (!value || typeof value !== "string") continue;
    try {
      const parsed = new URL(value.trim());
      if ((parsed.protocol === "https:" || parsed.protocol === "http:") && !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash) {
        configured.add(parsed.origin);
      }
    } catch {
    }
  }
  return configured;
}

function buildCorsHeaders(request, env) {
  const origin = request?.headers?.get("Origin") || "";
  const allowedOrigins = getConfiguredOrigins(env);
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Savonie-Debug",
    "Access-Control-Expose-Headers": "Retry-After",
    "Content-Type": "application/json",
    "Vary": "Origin",
    "X-Savonie-Version": CHAT_VERSION
  };
  if (origin && allowedOrigins.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function jsonReply(payload, status = 200, extraHeaders = {}, request, env) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(request, env),
      ...extraHeaders
    }
  });
}

function checkLocalRateLimit(key) {
  const currentTime = Date.now();
  const safeKey = String(key || "unknown").slice(0, 128);

  for (const [entryKey, entry] of LOCAL_RATE_LIMITER) {
    if (!entry || (currentTime - entry.firstRequestAt) > RATE_LIMIT_WINDOW_MS) {
      LOCAL_RATE_LIMITER.delete(entryKey);
    }
  }

  if (LOCAL_RATE_LIMITER.size >= RATE_LIMIT_MAX_KEYS && !LOCAL_RATE_LIMITER.has(safeKey)) {
    const oldestKey = LOCAL_RATE_LIMITER.keys().next().value;
    if (oldestKey !== undefined) LOCAL_RATE_LIMITER.delete(oldestKey);
  }

  const entry = LOCAL_RATE_LIMITER.get(safeKey);

  if (!entry || (currentTime - entry.firstRequestAt) > RATE_LIMIT_WINDOW_MS) {
    LOCAL_RATE_LIMITER.set(safeKey, {
      count: 1,
      firstRequestAt: currentTime
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function getRateLimitKey(request) {
  const forwarded = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "unknown";
  const first = forwarded.split(",", 1)[0].trim();
  return first && first.length <= 128 ? first : "unknown";
}

function isJsonContentType(request) {
  const contentType = request.headers.get("Content-Type") || "";
  return /^application\/json\s*(?:;|$)/i.test(contentType.trim());
}

async function parseBoundedBody(request) {
  const contentLengthHeader = request.headers.get("Content-Length");
  if (contentLengthHeader !== null) {
    if (!/^\d+$/.test(contentLengthHeader.trim())) {
      return { error: { status: 400, errorType: "BadRequest", reply: "Invalid Content-Length." } };
    }
    if (Number(contentLengthHeader) > MAX_REQUEST_BODY_BYTES) {
      return { error: { status: 413, errorType: "PayloadTooLarge", reply: "Request body is too large." } };
    }
  }

  if (!request.body || typeof request.body.getReader !== "function") {
    return { error: { status: 400, errorType: "BadRequest", reply: "Invalid JSON body." } };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let raw = "";
  let totalBytes = 0;
  try {
    while (true) {
      const chunkResult = await reader.read();
      if (chunkResult.done) break;
      const chunk = chunkResult.value instanceof Uint8Array
        ? chunkResult.value
        : new Uint8Array(chunkResult.value || []);
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_REQUEST_BODY_BYTES) {
        try { await reader.cancel("request body too large"); } catch {}
        return { error: { status: 413, errorType: "PayloadTooLarge", reply: "Request body is too large." } };
      }
      try {
        raw += decoder.decode(chunk, { stream: true });
      } catch {
        try { await reader.cancel("invalid utf-8"); } catch {}
        return { error: { status: 400, errorType: "BadRequest", reply: "Request body must be valid UTF-8." } };
      }
    }
    try {
      raw += decoder.decode();
    } catch {
      return { error: { status: 400, errorType: "BadRequest", reply: "Request body must be valid UTF-8." } };
    }
    try {
      const body = JSON.parse(raw);
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        return { error: { status: 400, errorType: "BadRequest", reply: "JSON body must be an object." } };
      }
      return { body };
    } catch {
      return { error: { status: 400, errorType: "BadRequest", reply: "Invalid JSON body." } };
    }
  } catch {
    return { error: { status: 400, errorType: "BadRequest", reply: "Invalid JSON body." } };
  } finally {
    try { reader.releaseLock(); } catch {}
  }
}

function validateMessage(value) {
  if (typeof value !== "string") return { error: "Message must be a string." };
  if (value.length > MAX_MESSAGE_LENGTH) return { error: "Message is too long." };
  const message = value.trim();
  if (!message) return { error: "Missing or empty message." };
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(message)) return { error: "Message contains unsupported control characters." };
  return { value: message };
}

function validateLanguage(value) {
  if (typeof value !== "string") return { error: "Language must be a string." };
  if (value.length > MAX_LANGUAGE_LENGTH || !/^(?:en|es|ar)$/i.test(value)) return { error: "Unsupported language." };
  return { value: value.toLowerCase() };
}

function validateHistory(value) {
  if (value === undefined) return { value: [] };
  if (!Array.isArray(value) || value.length > MAX_HISTORY_ITEMS) return { error: "History must contain at most 8 messages." };
  const history = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return { error: "Invalid history item." };
    const keys = Object.keys(item);
    if (item.kind === "card") {
      if (keys.some((key) => key !== "kind" && key !== "cardId") || typeof item.cardId !== "string" || !item.cardId.trim() || item.cardId.length > MAX_HISTORY_CARD_ID_LENGTH) {
        return { error: "Invalid history card." };
      }
      history.push({ kind: "card", cardId: item.cardId.trim() });
      continue;
    }
    if (item.kind !== "text" || keys.some((key) => !["kind", "sender", "text"].includes(key)) || !["user", "bot"].includes(item.sender) || typeof item.text !== "string" || !item.text.trim() || item.text.length > MAX_HISTORY_TEXT_LENGTH) {
      return { error: "Invalid history message." };
    }
    history.push({ kind: "text", sender: item.sender, text: item.text.trim() });
  }
  return { value: history };
}

function validatePlainPageText(value, maxLength) {
  if (typeof value !== "string" || value.length > maxLength) return false;
  if (/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F<>]/.test(value)) return false;
  if (/&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]+);/i.test(value)) return false;
  return cleanTextFragment(value) === value;
}

function validatePageContext(value, legacyPageContent) {
  if (value !== undefined && value !== null && (typeof value !== "object" || Array.isArray(value))) return { error: "Page context must be an object." };
  if (typeof legacyPageContent !== "undefined" && !validatePlainPageText(legacyPageContent, MAX_PAGE_CONTEXT_TEXT_LENGTH)) return { error: "Page content is invalid or too large." };

  if (value && typeof value === "object") {
    const allowedKeys = new Set(["route", "path", "title", "buildVersion", "description", "headings", "text", "pageContent"]);
    if (Object.keys(value).some((key) => !allowedKeys.has(key))) return { error: "Page context contains unsupported fields." };
    if (value.route !== undefined && value.path !== undefined) return { error: "Page context cannot provide both route and path." };
    if (value.text !== undefined && value.pageContent !== undefined) return { error: "Page context cannot provide both text and pageContent." };
    for (const key of ["route", "path", "title", "buildVersion", "description", "text", "pageContent"]) {
      if (value[key] !== undefined && typeof value[key] !== "string") return { error: `Page context field ${key} must be a string.` };
    }
    const routeValue = value.route !== undefined ? value.route : value.path;
    if (routeValue !== undefined && (!validatePlainPageText(routeValue, 160) || !routeValue.startsWith("/") || routeValue.startsWith("//") || normalizeRoute(routeValue) !== routeValue)) return { error: "Page context route must be an internal path." };
    if ((value.title !== undefined && !validatePlainPageText(value.title, 240)) || (value.buildVersion !== undefined && !validatePlainPageText(value.buildVersion, 100)) || (value.description !== undefined && !validatePlainPageText(value.description, 600)) || (value.text !== undefined && !validatePlainPageText(value.text, MAX_PAGE_CONTEXT_TEXT_LENGTH)) || (value.pageContent !== undefined && !validatePlainPageText(value.pageContent, MAX_PAGE_CONTEXT_TEXT_LENGTH))) {
      return { error: "Page context field is too large." };
    }
    if (value.headings !== undefined && (!Array.isArray(value.headings) || value.headings.length > MAX_PAGE_CONTEXT_HEADINGS || value.headings.some((heading) => !validatePlainPageText(heading, MAX_PAGE_CONTEXT_HEADING_LENGTH)))) {
      return { error: "Page context headings are invalid or too large." };
    }
  }
  return { value: value || null, legacyPageContent: legacyPageContent || "" };
}

async function callGemini({ apiKey, model, context, message, maxTokens }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: context
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.55,
            topP: 0.9,
            topK: 24,
            maxOutputTokens: maxTokens
          }
        }),
        signal: controller.signal
      }
    );

    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }

    if (!response.ok) {
      const errorCode = data?.error?.code || response.status;
      throw new Error(`gemini:${errorCode}`);
    }

    const candidate = data?.candidates?.[0];
    const reply = Array.isArray(candidate?.content?.parts)
      ? candidate.content.parts.map((part) => part?.text || "").join("").trim()
      : "";

    return reply;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateReply({ env, userMessage, language, chatContext }) {
  if (chatContext.deterministicOnly || !env.GEMINI_API_KEY) {
    return {
      reply: chatContext.fallbackReply,
      source: chatContext.deterministicOnly ? "deterministic" : "deterministic_no_api_key"
    };
  }

  const prompt = buildModelContext({
    message: userMessage,
    language,
    pageContext: chatContext.pageContext,
    profile: chatContext.profile,
    siteFacts: chatContext.siteFacts,
    retrieval: chatContext.retrieval,
    questionClass: chatContext.questionClass,
    surfaceFactKey: chatContext.surfaceFactKey,
    register: chatContext.register,
    manifestStatus: chatContext.manifestStatus,
    history: chatContext.history
  });

  const wantsDepth = /\b(detailed|detail|deeper|explain|walk me through|step by step|comprehensive|elaborate|in depth|thoroughly|tell me everything|full breakdown|break it down|unpack|expand on)\b/i.test(userMessage);
  const isComplex = userMessage.split(/\s+/).length > 10 || /\b(how|why|what makes|compare|difference|relationship|walk me through|strengths? and|tell me about.*and|as well as|in addition|also tell)\b/i.test(userMessage);
  const isRecruiterDeep = /\b(hiring manager|recruiter|candidate|operations|why.*strong|walk me through.*why|evaluate|assessment|fit for)\b/i.test(userMessage);
  const maxTokens = (wantsDepth || isRecruiterDeep) ? 1500 : (isComplex ? 1100 : 800);

  try {
    const primaryReply = await callGemini({
      apiKey: env.GEMINI_API_KEY,
      model: PRIMARY_MODEL,
      context: prompt,
      message: userMessage,
      maxTokens
    });

    const finalReply = postProcessReply(primaryReply, chatContext.fallbackReply);

    // Self-healing: if Gemini returned something too short or is just the fallback, try once more with a nudge
    if (finalReply === chatContext.fallbackReply && primaryReply && primaryReply.length > 20) {
      // Gemini gave a real reply but it got filtered — try fallback model
      try {
        const retryReply = await callGemini({
          apiKey: env.GEMINI_API_KEY,
          model: FALLBACK_MODEL,
          context: prompt + "\n\nIMPORTANT: Your previous answer was filtered. Make sure you speak in third person about Estivan, avoid banned phrases, and stay grounded in the provided facts.",
          message: userMessage,
          maxTokens
        });
        const retryFinal = postProcessReply(retryReply, chatContext.fallbackReply);
        return { reply: retryFinal, source: "gemini_self_healed" };
      } catch {
        // Fall through to normal fallback
      }
    }

    return {
      reply: finalReply,
      source: "gemini_primary"
    };
  } catch {
    try {
      const fallbackModelReply = await callGemini({
        apiKey: env.GEMINI_API_KEY,
        model: FALLBACK_MODEL,
        context: prompt,
        message: userMessage,
        maxTokens
      });

      const finalReply = postProcessReply(fallbackModelReply, chatContext.fallbackReply);
      return {
        reply: finalReply,
        source: "gemini_fallback"
      };
    } catch {
      return {
        reply: chatContext.fallbackReply,
        source: "deterministic_model_error"
      };
    }
  }
}

export default {
  async fetch(request, env) {
    const pathname = getCurrentPath(request);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders(request, env)
      });
    }

    if (request.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
      return jsonReply(buildHealthPayload(env), 200, {}, request, env);
    }

    if (pathname !== "/api/chat" && pathname !== "/chat") {
      return jsonReply({ errorType: "NotFound", reply: "Not found." }, 404, {}, request, env);
    }

    if (request.method !== "POST") {
      return jsonReply({ errorType: "MethodNotAllowed", reply: "Method not allowed." }, 405, {}, request, env);
    }

    if (!isJsonContentType(request)) {
      return jsonReply({ errorType: "UnsupportedMediaType", reply: "Content-Type must be application/json." }, 415, {}, request, env);
    }

    const parsedBody = await parseBoundedBody(request);
    if (parsedBody.error) {
      return jsonReply(parsedBody.error, parsedBody.error.status, {}, request, env);
    }
    const body = parsedBody.body;

    const messageResult = validateMessage(body.message);
    if (messageResult.error) return jsonReply({ errorType: "BadRequest", reply: messageResult.error }, 400, {}, request, env);
    const languageResult = validateLanguage(body.language);
    if (languageResult.error) return jsonReply({ errorType: "BadRequest", reply: languageResult.error }, 400, {}, request, env);
    const historyResult = validateHistory(body.history);
    if (historyResult.error) return jsonReply({ errorType: "BadRequest", reply: historyResult.error }, 400, {}, request, env);
    const pageContextResult = validatePageContext(body.pageContext, body.pageContent);
    if (pageContextResult.error) return jsonReply({ errorType: "BadRequest", reply: pageContextResult.error }, 400, {}, request, env);

    const userMessage = messageResult.value;
    const language = languageResult.value;
    const isDebug = new URL(request.url).searchParams.get("debug") === "1" || request.headers.get("X-Savonie-Debug") === "1";

    if (!shouldBypassRateLimit(env) && !checkLocalRateLimit(getRateLimitKey(request))) {
      return jsonReply({
        errorType: "RateLimit",
        reply: "Too many requests too quickly. Give me a minute and try again."
      }, 429, { "Retry-After": "60" }, request, env);
    }

    const chatContext = await prepareChatContext({
      env,
      request,
      message: userMessage,
      language,
      rawPageContext: pageContextResult.value,
      legacyPageContent: pageContextResult.legacyPageContent,
      history: historyResult.value
    });

    const replyResult = await generateReply({
      env,
      userMessage,
      language,
      chatContext
    });

    const finalReply = safeTruncate(replyResult.reply, MAX_REPLY_CHARS);
    const truncated = finalReply !== replyResult.reply;
    const payload = {
      errorType: null,
      reply: finalReply,
      chips: buildChips(chatContext.questionClass, chatContext.retrieval),
      truncated,
      continuation_hint: truncated ? getContinuationHint(replyResult.reply) : null,
      fallback_mode: replyResult.source.startsWith("deterministic"),
      manifestStatus: chatContext.manifestStatus,
      buildVersion: chatContext.manifest?.buildVersion || chatContext.pageContext?.buildVersion || "",
      version: CHAT_VERSION
    };

    if (isDebug) {
      payload.debug = buildDebugPayload(chatContext, replyResult.source);
    }

    return jsonReply(payload, 200, {}, request, env);
  }
};
