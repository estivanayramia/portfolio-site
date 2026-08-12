const env = process.env;

async function run() {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is required.");
    process.exitCode = 2;
    return;
  }

  const endpoint = env.GEMINI_ENDPOINT || "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{ text: "Reply with the single word OK." }],
      }],
      generationConfig: { maxOutputTokens: 8, temperature: 0 },
    }),
  });

  console.log(`status=${response.status}`);
  if (!response.ok) process.exitCode = 1;
}

run().catch(() => {
  console.error("Gemini request failed.");
  process.exitCode = 1;
});
