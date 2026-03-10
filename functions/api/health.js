import { handleHealth, handleOptions, methodNotAllowed } from "../_lib/dashboard-api.js";

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return handleOptions(context.request);
  if (context.request.method !== "GET") return methodNotAllowed(context.request, ["GET", "OPTIONS"]);
  return handleHealth(context);
}