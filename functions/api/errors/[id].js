import { handleErrorItem, handleOptions } from "../../_lib/dashboard-api.js";

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return handleOptions(context.request, context.env);
  return handleErrorItem(context);
}
