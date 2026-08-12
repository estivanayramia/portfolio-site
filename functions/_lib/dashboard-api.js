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

function isExactOrigin(value) {
  if (typeof value !== "string" || !value) return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.origin === value;
  } catch {
    return false;
  }
}
function getConfiguredOrigins(env) {
  if (typeof env?.DASHBOARD_ALLOWED_ORIGINS !== "string") return [];
  return env.DASHBOARD_ALLOWED_ORIGINS
    .split(",")
    .map((origin) => origin.trim())
    .filter(isExactOrigin);
}

export function getAllowedOrigins(request, env = {}) {
  void request;
  return [...new Set([...STATIC_ALLOWED_ORIGINS, ...getConfiguredOrigins(env)])];
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return typeof origin === "string" && getAllowedOrigins(request, env).includes(origin);
}

export function getCorsHeaders(request, env = {}) {
  const headers = { Vary: "Origin" };
  if (!isAllowedOrigin(request, env)) return headers;

  return {
    ...headers,
    "Access-Control-Allow-Origin": request.headers.get("Origin"),
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

export function jsonReply(body, status, request, extraHeaders = {}, env = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request, env),
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

export function methodNotAllowed(request, allowedMethods, env = {}) {
  return jsonReply(
    { error: "method_not_allowed" },
    405,
    request,
    { Allow: allowedMethods.join(", ") },
    env
  );
}

export function handleOptions(request, env = {}) {
  const origin = request.headers.get("Origin");
  const allowed = !origin || isAllowedOrigin(request, env);
  return new Response(null, {
    status: allowed ? 204 : 403,
    headers: getCorsHeaders(request, env),
  });
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
  let databaseReady = false;
  try {
    if (env.DB) {
      const result = await env.DB.prepare("SELECT 1 as ok").all();
      databaseReady = Array.isArray(result?.results) && result.results.length > 0;
    }
  } catch {
    databaseReady = false;
  }

  return jsonReply(
    {
      status: env.SAVONIE_KV && databaseReady ? "ok" : "degraded",
      version: getVersionTag(env),
    },
    200,
    request,
    {},
    env
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
      request,
      {},
      env
    );
  }

  if (needsDb && !env.DB) {
    return jsonReply(
      {
        error: "server_not_configured",
        message: "Missing DB binding for dashboard API.",
      },
      500,
      request,
      {},
      env
    );
  }

  return null;
}

export async function handleAuth(context) {
  const { request, env } = context;
  const bindingError = requireBindings(request, env, false);
  if (bindingError) return bindingError;
  const response = await apiHandleAuth(request, env, getAllowedOrigins(request, env));
  return withCors(response, request, env);
}

export async function handleErrorReport(context) {
  const { request, env } = context;
  const bindingError = requireBindings(request, env, true);
  if (bindingError) return bindingError;
  const response = await apiHandleErrorReport(request, env, getAllowedOrigins(request, env));
  return withCors(response, request, env);
}

export async function handleErrorsCollection(context) {
  const { request, env } = context;
  const bindingError = requireBindings(request, env, true);
  if (bindingError) return bindingError;
  const response = await apiHandleGetErrors(request, env, getAllowedOrigins(request, env));
  return withCors(response, request, env);
}

export async function handleErrorItem(context) {
  const { request, env, params } = context;
  const bindingError = requireBindings(request, env, true);
  if (bindingError) return bindingError;

  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return jsonReply({ error: "not_found" }, 404, request, {}, env);
  }

  const allowedOrigins = getAllowedOrigins(request, env);

  if (request.method === "GET") {
    const response = await apiHandleGetErrorById(request, env, allowedOrigins, id);
    return withCors(response, request, env);
  }
  if (request.method === "PATCH") {
    const response = await apiHandleUpdateError(request, env, allowedOrigins, id);
    return withCors(response, request, env);
  }
  if (request.method === "DELETE") {
    const response = await apiHandleDeleteError(request, env, allowedOrigins, id);
    return withCors(response, request, env);
  }

  return methodNotAllowed(request, ["GET", "PATCH", "DELETE", "OPTIONS"], env);
}

function withCors(response, request, env) {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(getCorsHeaders(request, env))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
