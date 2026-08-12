import { CHAT_VERSION } from "./chat-service.mjs";

export function buildHealthPayload() {
  return {
    status: "ok",
    version: CHAT_VERSION,
  };
}
