import {
  apiHandleAuth,
  apiHandleDeleteError,
  apiHandleErrorReport,
  apiHandleGetErrorById,
  apiHandleGetErrors,
  apiHandleUpdateError,
} from "../../worker/error-api.js";

const STATIC_ALLOWED_ORIGINS = [
  "https://estivanayramia.com",
  "https://www.estivanayramia.com",
];

function isLocalhostOrigin(origin) {
  return typeof origin === "string" && (
    origin.startsWith("http://localhost:") ||
    origin.startsWith("http://127.0.0.1:")
  );
}

function isPagesOrigin(origin) {
  return typeof origin === "string" && /^https:\/\/([a-z0-9-]+\.)+pages\.dev$/i.test(origin);
}

function isWorkersOrigin(origin) {
  return typeof origin === "string" && /^https:\/\/([a-z0-9-]+\.)+workers\.dev$/i.test(origin);
}

export function getAllowedOrigins(request) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = [...STATIC_ALLOWED_ORIGINS];

  if (isLocalhostOrigin(origin) || isPagesOrigin(origin) || isWorkersOrigin(origin)) {
    allowedOrigins.push(origin);
  }

  return allowedOrigins;
}

export function getCorsHeaders(request) {
  const origin = request.headers.get("Origin");
  const isExplicitlyAllowed = STATIC_ALLOWED_ORIGINS.includes(origin) ||
    isLocalhostOrigin(origin) ||
    isPagesOrigin(origin) ||
    isWorkersOrigin(origin);

  return {
    "Access-Control-Allow-Origin": isExplicitlyAllowed ? origin : STATIC_ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function jsonReply(body, status, request, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function methodNotAllowed(request, allowedMethods) {
  return jsonReply(
    { error: "method_not_allowed" },
    405,
    request,
    { Allow: allowedMethods.join(", ") }
  );
}

export function handleOptions(request) {
  return new Response(null, { headers: getCorsHeaders(request) });
}

function normalizeSecret(value) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed === "__SET_VIA_CLOUDFLARE_SECRETS__") return "";
  return trimmed;
}

function getVersionTag(env) {
  const sha = typeof env?.CF_PAGES_COMMIT_SHA === "string" ? env.CF_PAGES_COMMIT_SHA.trim() : "";
  if (sha) return sha.slice(0, 7);
  return "pages-api";
}

export async function handleHealth(context) {
  const { request, env } = context;
  const authPlain = normalizeSecret(env.DASHBOARD_PASSWORD);
  const authHashOrPlain = normalizeSecret(env.DASHBOARD_PASSWORD_HASH);
  const authConfigured = !!(authPlain || authHashOrPlain);
  const authSource = authPlain ? "DASHBOARD_PASSWORD" : (authHashOrPlain ? "DASHBOARD_PASSWORD_HASH" : null);

  let d1Ok = false;
  try {
    if (env.DB) {
      const result = await env.DB.prepare("SELECT 1 as ok").all();
      d1Ok = Array.isArray(result?.results) && result.results.length > 0;
    }
  } catch {
    d1Ok = false;
  }

  const kvOk = !!env.SAVONIE_KV;

  return jsonReply(
    {
      ok: kvOk && d1Ok,
      service: typeof env.SERVICE_NAME === "string" ? env.SERVICE_NAME : "portfolio-pages",
      version: getVersionTag(env),
      kv: kvOk,
      d1Ok,
      authConfigured,
      authSource,
      errorApi: true,
      runtime: "pages-functions",
    },
    200,
    request
  );
}

function requireBindings(request, env, needsDb) {
  if (!env.SAVONIE_KV) {
    return jsonReply(
      {
        error: "server_not_configured",
        message: "Missing SAVONIE_KV binding for dashboard API.",
      },
      500,
      request
    );
  }

  if (needsDb && !env.DB) {
    return jsonReply(
      {
        error: "server_not_configured",
        message: "Missing DB binding for dashboard API.",
      },
      500,
      request
    );
  }

  return null;
}

export async function handleAuth(context) {
  const { request, env } = context;
  const bindingError = requireBindings(request, env, false);
  if (bindingError) return bindingError;
  return apiHandleAuth(request, env, getAllowedOrigins(request));
}

export async function handleErrorReport(context) {
  const { request, env } = context;
  const bindingError = requireBindings(request, env, true);
  if (bindingError) return bindingError;
  return apiHandleErrorReport(request, env, getAllowedOrigins(request));
}

export async function handleErrorsCollection(context) {
  const { request, env } = context;
  const bindingError = requireBindings(request, env, true);
  if (bindingError) return bindingError;
  return apiHandleGetErrors(request, env, getAllowedOrigins(request));
}

export async function handleErrorItem(context) {
  const { request, env, params } = context;
  const bindingError = requireBindings(request, env, true);
  if (bindingError) return bindingError;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonReply({ error: "not_found" }, 404, request);
  }

  const allowedOrigins = getAllowedOrigins(request);

  if (request.method === "GET") {
    return apiHandleGetErrorById(request, env, allowedOrigins, id);
  }
  if (request.method === "PATCH") {
    return apiHandleUpdateError(request, env, allowedOrigins, id);
  }
  if (request.method === "DELETE") {
    return apiHandleDeleteError(request, env, allowedOrigins, id);
  }

  return methodNotAllowed(request, ["GET", "PATCH", "DELETE", "OPTIONS"]);
}