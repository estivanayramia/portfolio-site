import { handleAuth, handleOptions, methodNotAllowed } from "../_lib/dashboard-api.js";

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return handleOptions(context.request, context.env);
  if (context.request.method !== "POST") return methodNotAllowed(context.request, ["POST", "OPTIONS"], context.env);
  return handleAuth(context);
}
