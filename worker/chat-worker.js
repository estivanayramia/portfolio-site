import CombinedWorker from "./worker.mjs";

function isChatPath(pathname) {
  return pathname === "/api/chat" || pathname === "/chat";
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!isChatPath(url.pathname) || !["POST", "OPTIONS"].includes(request.method)) {
      return new Response("Not found", { status: 404, headers: { "Vary": "Origin" } });
    }

    return CombinedWorker.fetch(request, env, ctx);
  }
};
