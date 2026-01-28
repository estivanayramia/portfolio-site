/* worker/error-api.js - Hardened backend with opaque sessions */

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders
    }
  });
}

function getClientIP(request) {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "0.0.0.0"
  );
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function sha256Hex(str) {
  const data = new TextEncoder().encode(str);
  const digest = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function requireOrigin(request, allowedOrigins) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  return allowedOrigins.includes(origin);
}

async function readJsonWithLimit(request, maxBytes) {
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) throw new Error("payload_too_large");
  const txt = new TextDecoder().decode(buf);
  return JSON.parse(txt);
}

function redactObject(obj) {
  const SENSITIVE_KEY_RE = /(token|auth|password|secret|session|cookie|credit|card|ssn|cvv|email)/i;
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.slice(0, 100).map(redactObject);
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (/authorization/i.test(k) || SENSITIVE_KEY_RE.test(k)) out[k] = "[Redacted]";
    else out[k] = typeof v === "string" ? (v.length > 500 ? v.slice(0, 500) + "" : v) : redactObject(v);
  }
  return out;
}

async function rateLimitKV(kv, key, max, windowMs) {
  const now = Date.now();
  const bucket = await kv.get(key, "json");
  if (!bucket || typeof bucket !== "object") {
    await kv.put(key, JSON.stringify({ n: 1, start: now }), { expirationTtl: Math.ceil(windowMs / 1000) });
    return true;
  }
  if (now - bucket.start > windowMs) {
    await kv.put(key, JSON.stringify({ n: 1, start: now }), { expirationTtl: Math.ceil(windowMs / 1000) });
    return true;
  }
  if (bucket.n >= max) return false;
  await kv.put(key, JSON.stringify({ n: bucket.n + 1, start: bucket.start }), { expirationTtl: Math.ceil(windowMs / 1000) });
  return true;
}

function parseBearer(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function requireSession(request, env) {
  const token = parseBearer(request);
  if (!token) return { ok: false };

  const key = sess:;
  const session = await env.SAVONIE_KV.get(key, "json");
  if (!session) return { ok: false };

  const max = Number(env.RATE_LIMIT_MAX || "10");
  const windowMs = Number(env.RATE_LIMIT_WINDOW || "60000");
  const ok = await rateLimitKV(env.SAVONIE_KV, l:sess:, max, windowMs);
  if (!ok) return { ok: false, status: 429 };

  return { ok: true, token, session };
}

export async function apiHandleAuth(request, env, allowedOrigins) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!requireOrigin(request, allowedOrigins)) return json({ error: "bad_origin" }, 403);

  const ct = request.headers.get("Content-Type") || "";
  if (!ct.toLowerCase().includes("application/json")) return json({ error: "bad_content_type" }, 415);

  const max = Number(env.RATE_LIMIT_MAX || "10");
  const windowMs = Number(env.RATE_LIMIT_WINDOW || "60000");
  const ip = getClientIP(request);
  const ipOK = await rateLimitKV(env.SAVONIE_KV, l:ip:, max, windowMs);
  if (!ipOK) return json({ error: "rate_limited" }, 429);

  let body;
  try {
    body = await readJsonWithLimit(request, 32 * 1024);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!password) return json({ error: "missing_password" }, 400);

  const expected = env.DASHBOARD_PASSWORD_HASH;
  if (!expected) return json({ error: "server_not_configured" }, 500);

  let ok = false;
  if (/^[a-f0-9]{64}$/i.test(expected)) {
    const got = await sha256Hex(password);
    ok = timingSafeEqual(got, expected.toLowerCase());
  } else {
    ok = timingSafeEqual(password, expected);
  }

  if (!ok) return json({ error: "unauthorized" }, 401);

  const token = randomToken();
  const sess = {
    created: Date.now(),
    ip,
    ua: request.headers.get("User-Agent") || ""
  };

  await env.SAVONIE_KV.put(sess:, JSON.stringify(sess), { expirationTtl: 60 * 60 * 24 });

  return json({ token });
}

export async function apiHandleErrorReport(request, env, allowedOrigins) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!requireOrigin(request, allowedOrigins)) return json({ error: "bad_origin" }, 403);

  const ct = request.headers.get("Content-Type") || "";
  if (!ct.toLowerCase().includes("application/json")) return json({ error: "bad_content_type" }, 415);

  const max = Number(env.RATE_LIMIT_MAX || "10");
  const windowMs = Number(env.RATE_LIMIT_WINDOW || "60000");
  const ip = getClientIP(request);
  const ipOK = await rateLimitKV(env.SAVONIE_KV, l:ip:, max * 2, windowMs);
  if (!ipOK) return json({ error: "rate_limited" }, 429);

  let body;
  try {
    body = await readJsonWithLimit(request, 256 * 1024);
  } catch (e) {
    const msg = String(e && e.message || "");
    if (msg.includes("payload_too_large")) return json({ error: "payload_too_large" }, 413);
    return json({ error: "invalid_json" }, 400);
  }

  const issues = Array.isArray(body.issues) ? body.issues : [];
  if (!issues.length) return json({ ok: true, stored: 0 });

  const ua = request.headers.get("User-Agent") || "";
  const url = typeof body.ctx?.url === "string" ? body.ctx.url : "";
  const version = typeof body.buildVersion === "string" ? body.buildVersion : "";

  const toStore = issues.slice(0, 20).map((it) => {
    const kind = typeof it.kind === "string" ? it.kind : "issue";
    const msg = typeof it.msg === "string" ? it.msg : "issue";
    const level = typeof it.level === "string" ? it.level : "error";

    const stack = typeof it.stack === "string" ? it.stack.slice(0, 2000) : "";
    const safeData = redactObject(it.data || {});
    const safeUrl = typeof it.url === "string" ? it.url : url;

    const message = ${msg} |  |  | ;

    return {
      type: kind,
      message,
      url: safeUrl,
      stack,
      user_agent: ua,
      version
    };
  });

  const stmt = env.DB.prepare(
    INSERT INTO errors (type, message, url, stack, user_agent, timestamp, category, status, is_bot, version)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
  );

  let stored = 0;
  for (const it of toStore) {
    await stmt.bind(
      it.type,
      it.message,
      it.url,
      it.stack,
      it.user_agent,
      Date.now(),
      "telemetry",
      "new",
      0,
      it.version
    ).run();
    stored += 1;
  }

  return json({ ok: true, stored });
}

export async function apiHandleGetErrors(request, env, allowedOrigins) {
  if (!requireOrigin(request, allowedOrigins)) return json({ error: "bad_origin" }, 403);

  const auth = await requireSession(request, env);
  if (!auth.ok) return json({ error: "unauthorized" }, auth.status || 401);

  const u = new URL(request.url);
  const limit = Math.min(Number(u.searchParams.get("limit") || "50"), 200);
  const offset = Math.max(Number(u.searchParams.get("offset") || "0"), 0);

  const rows = await env.DB.prepare(
    SELECT id, type, message, url, stack, category, status, user_agent, is_bot, timestamp, version
     FROM errors
     ORDER BY timestamp DESC
     LIMIT ?1 OFFSET ?2
  ).bind(limit, offset).all();

  const total = await env.DB.prepare(SELECT COUNT(*) as c FROM errors).all();

  return json({
    errors: (rows.results || []).map(redactObject),
    total: (total.results && total.results[0] && total.results[0].c) ? total.results[0].c : 0
  });
}

export async function apiHandleUpdateError(request, env, allowedOrigins, id) {
  if (!requireOrigin(request, allowedOrigins)) return json({ error: "bad_origin" }, 403);

  const auth = await requireSession(request, env);
  if (!auth.ok) return json({ error: "unauthorized" }, auth.status || 401);

  const ct = request.headers.get("Content-Type") || "";
  if (!ct.toLowerCase().includes("application/json")) return json({ error: "bad_content_type" }, 415);

  let body;
  try {
    body = await readJsonWithLimit(request, 16 * 1024);
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const category = typeof body.category === "string" ? body.category.slice(0, 40) : null;
  const status = typeof body.status === "string" ? body.status.slice(0, 40) : null;

  if (!category && !status) return json({ error: "no_changes" }, 400);

  await env.DB.prepare(
    UPDATE errors SET category = COALESCE(?1, category), status = COALESCE(?2, status) WHERE id = ?3
  ).bind(category, status, id).run();

  return json({ ok: true });
}

export async function apiHandleDeleteError(request, env, allowedOrigins, id) {
  if (!requireOrigin(request, allowedOrigins)) return json({ error: "bad_origin" }, 403);

  const auth = await requireSession(request, env);
  if (!auth.ok) return json({ error: "unauthorized" }, auth.status || 401);

  await env.DB.prepare(DELETE FROM errors WHERE id = ?1).bind(id).run();
  return json({ ok: true });
}