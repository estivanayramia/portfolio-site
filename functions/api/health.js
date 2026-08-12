import { handleHealth, handleOptions, methodNotAllowed } from "../_lib/dashboard-api.js";

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return handleOptions(context.request, context.env);
  if (context.request.method !== "GET") return methodNotAllowed(context.request, ["GET", "OPTIONS"], context.env);
  return handleHealth(context);
}
