import {
  CHAT_VERSION,
  buildChips,
  buildModelContext,
  postProcessReply,
  prepareChatContext
} from "./chat-service.mjs";

const GEMINI_TIMEOUT_MS = 25000;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_REPLY_CHARS = 3200;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 20;
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.5-pro";

const LOCAL_RATE_LIMITER = globalThis.__savonieRateLimiter || (globalThis.__savonieRateLimiter = new Map());

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Savonie-Debug",
    "Content-Type": "application/json",
    "X-Savonie-Version": CHAT_VERSION
  };
}

function jsonReply(payload, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...buildCorsHeaders(),
      ...extraHeaders
    }
  });
}

function safeTruncate(text, limit) {
  const input = String(text || "").trim();
  if (!input || input.length <= limit) return input;

  const clipped = input.slice(0, limit);
  const lastSentence = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("? "),
    clipped.lastIndexOf("! ")
  );

  if (lastSentence >= limit - 220) {
    return clipped.slice(0, lastSentence + 1).trim();
  }

  const lastSpace = clipped.lastIndexOf(" ");
  if (lastSpace > 0) {
    return `${clipped.slice(0, lastSpace).trim()}...`;
  }

  return `${clipped.slice(0, Math.max(0, limit - 3)).trim()}...`;
}

function checkLocalRateLimit(key) {
  const currentTime = Date.now();
  const entry = LOCAL_RATE_LIMITER.get(key);

  if (!entry || (currentTime - entry.firstRequestAt) > RATE_LIMIT_WINDOW_MS) {
    LOCAL_RATE_LIMITER.set(key, {
      count: 1,
      firstRequestAt: currentTime
    });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function shouldBypassRateLimit(env) {
  return env?.DISABLE_RATE_LIMIT === "1" || env?.__TEST_DISABLE_RATE_LIMIT === true;
}

function getContinuationHint(reply) {
  const input = String(reply || "");
  return input.slice(-700);
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
                  text: `${context}\n\nUSER QUESTION:\n${message}`
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
    register: chatContext.register,
    manifestStatus: chatContext.manifestStatus
  });

  const wantsDepth = /\b(detailed|detail|deeper|explain|walk me through|step by step)\b/i.test(userMessage);
  const maxTokens = wantsDepth ? 800 : 500;

  try {
    const primaryReply = await callGemini({
      apiKey: env.GEMINI_API_KEY,
      model: PRIMARY_MODEL,
      context: prompt,
      message: userMessage,
      maxTokens
    });

    const finalReply = postProcessReply(primaryReply, chatContext.fallbackReply);
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

function buildHealthPayload(env) {
  return {
    ok: true,
    version: CHAT_VERSION,
    hasGeminiKey: Boolean(env?.GEMINI_API_KEY),
    hasKv: Boolean(env?.SAVONIE_KV),
    factsKey: "site-facts:v1",
    profileKey: "profile:public:v1",
    pageManifestKey: "page-grounding:v1",
    siteBaseUrl: env?.SITE_BASE_URL || "https://www.estivanayramia.com"
  };
}

function buildDebugPayload(chatContext, modelSource) {
  return {
    questionClass: chatContext.questionClass,
    register: chatContext.register,
    manifestStatus: chatContext.manifestStatus,
    manifestBuildVersion: chatContext.manifest?.buildVersion || "",
    currentPage: chatContext.pageContext,
    retrievedRoutes: chatContext.retrieval.pages.map((page) => page.route),
    modelSource
  };
}

function getCurrentPath(request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "";
  }
}

export default {
  async fetch(request, env) {
    const pathname = getCurrentPath(request);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: buildCorsHeaders()
      });
    }

    if (request.method === "GET" && (pathname === "/health" || pathname === "/api/health")) {
      return jsonReply(buildHealthPayload(env));
    }

    if (pathname !== "/api/chat" && pathname !== "/chat") {
      return jsonReply({ errorType: "NotFound", reply: "Not found." }, 404);
    }

    if (request.method !== "POST") {
      return jsonReply({ errorType: "MethodNotAllowed", reply: "Method not allowed." }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonReply({ errorType: "BadRequest", reply: "Invalid JSON body." }, 400);
    }

    const userMessage = String(body?.message || "").trim().slice(0, MAX_MESSAGE_LENGTH);
    const language = String(body?.language || "en").trim() || "en";
    const isDebug = new URL(request.url).searchParams.get("debug") === "1" || request.headers.get("X-Savonie-Debug") === "1";

    if (!userMessage) {
      return jsonReply({ errorType: "BadRequest", reply: "Missing or empty message." }, 400);
    }

    const clientKey = request.headers.get("CF-Connecting-IP") || request.headers.get("x-forwarded-for") || "unknown";
    if (!shouldBypassRateLimit(env) && !checkLocalRateLimit(clientKey)) {
      return jsonReply({
        errorType: "RateLimit",
        reply: "Too many requests too quickly. Give me a minute and try again."
      }, 429, { "Retry-After": "60" });
    }

    const chatContext = await prepareChatContext({
      env,
      request,
      message: userMessage,
      language,
      rawPageContext: body?.pageContext || null,
      legacyPageContent: body?.pageContent || ""
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

    return jsonReply(payload);
  }
};
