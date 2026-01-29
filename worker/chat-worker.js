import CombinedWorker from "./worker.js";

function isChatPath(pathname) {
  return pathname === "/api/chat" || pathname === "/chat";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Only allow chat endpoints for this worker.
    // This prevents accidental exposure if someone hits the workers.dev URL directly.
    if (!isChatPath(url.pathname)) {
      // Allow preflight to succeed quietly (some browsers/extensions probe paths)
      if (request.method === "OPTIONS") return new Response(null, { status: 204 });
      return new Response("Not found", { status: 404 });
    }

    return CombinedWorker.fetch(request, env, ctx);
  }
};
