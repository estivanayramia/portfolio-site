import CombinedWorker from "./worker.js";

function isDebuggerPath(pathname) {
  if (pathname === "/api/error-report") return true;
  if (pathname === "/api/auth") return true;
  if (pathname === "/api/health" || pathname === "/health") return true;
  if (pathname === "/api/errors" || pathname === "/api/errors/") return true;
  if (/^\/api\/errors\/\d+$/.test(pathname)) return true;
  return false;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only allow debugger/ingestion endpoints for this worker.
    // This prevents accidental exposure if someone hits the workers.dev URL directly.
    if (!isDebuggerPath(url.pathname)) {
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      return new Response("Not found", { status: 404 });
    }

    return CombinedWorker.fetch(request, env, ctx);
  }
};
