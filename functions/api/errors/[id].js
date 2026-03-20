import { handleErrorItem, handleOptions } from "../../_lib/dashboard-api.js";

export async function onRequest(context) {
  if (context.request.method === "OPTIONS") return handleOptions(context.request);
  return handleErrorItem(context);
}