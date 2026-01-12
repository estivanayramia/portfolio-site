import worker from '../worker/worker.mjs';
import assert from 'assert';

// Mock Global Fetch
const originalFetch = global.fetch;
let mockResponses = [];

global.fetch = async (url, options) => {
  if (mockResponses.length > 0) {
    const res = mockResponses.shift();
    return {
      ok: true, 
      status: 200,
      json: async () => res
    };
  }
  return { ok: false, status: 500 };
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

testTruncationAndContinuation().catch(e => {
  console.error("FAILED:", e);
  process.exit(1);
});
