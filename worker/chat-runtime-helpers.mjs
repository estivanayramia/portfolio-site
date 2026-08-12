export function safeTruncate(text, limit) {
  const input = String(text || "").trim();
  if (!input || input.length <= limit) return input;

  const clipped = input.slice(0, limit);
  const lastSentence = Math.max(
    clipped.lastIndexOf(". "),
    clipped.lastIndexOf("? "),
    clipped.lastIndexOf("! ")
  );

  if (lastSentence >= limit - 220) return clipped.slice(0, lastSentence + 1).trim();

  const lastSpace = clipped.lastIndexOf(" ");
  if (lastSpace > 0) return `${clipped.slice(0, lastSpace).trim()}...`;

  return `${clipped.slice(0, Math.max(0, limit - 3)).trim()}...`;
}
export function getContinuationHint(reply) {
  return String(reply || "").slice(-700);
}

export function buildDebugPayload(chatContext, modelSource) {
  return {
    questionClass: chatContext.questionClass,
    register: chatContext.register,
    manifestStatus: chatContext.manifestStatus,
    manifestBuildVersion: chatContext.manifest?.buildVersion || "",
    currentPage: chatContext.pageContext,
    retrievedRoutes: chatContext.retrieval.pages.map((page) => page.route),
    modelSource,
    replyLength: modelSource === "deterministic" ? "n/a" : "see_response",
    selfHealed: modelSource === "gemini_self_healed"
  };
}

export function getCurrentPath(request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "";
  }
}

export function shouldBypassRateLimit(env) {
  return env?.DISABLE_RATE_LIMIT === "1" || env?.__TEST_DISABLE_RATE_LIMIT === true;
}
