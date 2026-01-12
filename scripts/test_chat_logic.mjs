import worker from '../worker/worker.js';
import assert from 'assert';

// Mock Global Fetch
const originalFetch = global.fetch;
let mockResponses = [];

global.fetch = async (url, options) => {
  if (mockResponses.length > 0) {
    const res = mockResponses.shift();
    return {
      ok: res.ok !== false, 
      status: res.status || 200,
      text: async () => res.text || JSON.stringify(res.body || {})
    };
  }
  return { ok: false, status: 500, text: async () => '' };
};

async function testTruncationAndContinuation() {
  console.log("Running Chat Logic Tests...");
  
  const env = { GEMINI_API_KEY: "test-key" };
  
  // TEST 1: Auto-Continuation
  // Scenario: First calls returns MAX_TOKENS, second call returns rest.
  console.log("Test 1: Auto-Continuation via Recursion");
  
  mockResponses = [
    // 1. Initial Call (truncated)
    {
      candidates: [{
        content: { parts: [{ text: "Part 1 of the story..." }] },
        finishReason: "MAX_TOKENS"
      }]
    },
    // 2. Continuation Call
    {
      candidates: [{
        content: { parts: [{ text: "Part 2 of the story." }] },
        finishReason: "STOP"
      }]
    }
  ];

  const req1 = {
    method: "POST",
    headers: { get: () => "localhost" },
    json: async () => ({ message: "Tell me a story" })
  };

  const res1 = await worker.fetch(req1, env);
  const body1 = await res1.json();
  
  assert.strictEqual(body1.reply, "Part 1 of the story...Part 2 of the story.");
  assert.strictEqual(body1.truncated, false, "Should not be truncated after successful continuation");
  console.log("PASS: Auto-Continuation stitched correctly.");


  // TEST 2: Hard Truncation (Safety Limit)
  // Scenario: Combined text exceeds 8000 chars.
  console.log("Test 2: Hard Safety Truncation (8000 chars)");
  
  const longText = "A".repeat(8500);
  mockResponses = [
    {
      candidates: [{
        content: { parts: [{ text: longText }] },
        finishReason: "STOP"
      }]
    }
  ];

  const req2 = {
    method: "POST",
    headers: { get: () => "localhost" },
    json: async () => ({ message: "Tell me a long story" })
  };

  const res2 = await worker.fetch(req2, env);
  const body2 = await res2.json();
  
  assert.ok(body2.reply.length <= 8000, "Reply should be <= 8000 chars");
  assert.strictEqual(body2.truncated, true, "Should be marked truncated");
  assert.ok(body2.continuation_hint, "Should have continuation hint");
  console.log("PASS: Hard truncation enforced.");

  console.log("All tests passed!");
}

async function testErrorHandling() {
  console.log("Running Error Handling Tests...");
  
  const env = { GEMINI_API_KEY: "test-key" };
  
  // TEST 3: Upstream 429 -> 503 UpstreamBusy
  console.log("Test 3: Upstream 429 returns 503 UpstreamBusy");
  
  mockResponses = [
    {
      ok: false,
      status: 429,
      text: JSON.stringify({ error: { code: 429, message: "Rate limited" } })
    }
  ];

  const req3 = {
    method: "POST",
    headers: { get: () => "localhost" },
    json: async () => ({ message: "Hello" })
  };

  const res3 = await worker.fetch(req3, env);
  const body3 = await res3.json();
  
  assert.strictEqual(res3.status, 503, "Should return 503 for upstream 429");
  assert.strictEqual(body3.errorType, "UpstreamBusy", "Should have UpstreamBusy errorType");
  assert.ok(body3.reply.includes("rate limited"), "Should have appropriate message");
  console.log("PASS: 429 handled correctly.");

  // TEST 4: Upstream 403 -> 503 AuthError
  console.log("Test 4: Upstream 403 returns 503 AuthError");
  
  mockResponses = [
    {
      ok: false,
      status: 403,
      text: JSON.stringify({ error: { code: 403, message: "Forbidden" } })
    }
  ];

  const req4 = {
    method: "POST",
    headers: { get: () => "localhost" },
    json: async () => ({ message: "Hello" })
  };

  const res4 = await worker.fetch(req4, env);
  const body4 = await res4.json();
  
  assert.strictEqual(res4.status, 503, "Should return 503 for upstream 403");
  assert.strictEqual(body4.errorType, "AuthError", "Should have AuthError errorType");
  console.log("PASS: 403 handled correctly.");

  // TEST 5: Timeout -> 504 Timeout
  console.log("Test 5: Timeout returns 504 Timeout");
  
  mockResponses = [
    {
      ok: false,
      status: 500,
      text: "Request timeout"
    }
  ];

  const req5 = {
    method: "POST",
    headers: { get: () => "localhost" },
    json: async () => ({ message: "Hello" })
  };

  const res5 = await worker.fetch(req5, env);
  const body5 = await res5.json();
  
  assert.strictEqual(res5.status, 504, "Should return 504 for timeout");
  assert.strictEqual(body5.errorType, "Timeout", "Should have Timeout errorType");
  console.log("PASS: Timeout handled correctly.");

  console.log("Error handling tests passed!");
}

testTruncationAndContinuation().then(() => testErrorHandling()).catch(e => {
  console.error("FAILED:", e);
  process.exit(1);
});
