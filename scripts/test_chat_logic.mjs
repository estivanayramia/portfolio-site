import worker from '../worker/worker.js';
import assert from 'assert';

// Mock Global Fetch
const originalFetch = global.fetch;
let mockResponses = [];

global.fetch = async (url) => {
  const urlStr = String(url ?? '');
  if (urlStr.includes('/assets/data/site-facts.json')) {
    return new Response(
      JSON.stringify({ projects: [], hobbies: [] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (mockResponses.length > 0) {
    const res = mockResponses.shift();
    if (res && res.throw) {
      throw res.throw;
    }
    const status = res.status ?? 200;
    const text = res.text ?? JSON.stringify(res.body ?? res);
    return new Response(text, {
      status,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return new Response('', { status: 500 });
};

function makeReq(message, previousContext) {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '127.0.0.1',
      Origin: 'http://localhost'
    },
    body: JSON.stringify({
      message,
      language: 'en',
      pageContent: 'path: /\ntitle: test',
      ...(previousContext ? { previousContext } : {})
    })
  });
}

async function testTruncationAndContinuation() {
  console.log("Running Chat Logic Tests...");
  
  const env = { GEMINI_API_KEY: "test-key-12345" };
  
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

  const res1 = await worker.fetch(makeReq("Tell me a story"), env);
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

  const res2 = await worker.fetch(makeReq("Tell me a long story"), env);
  const body2 = await res2.json();
  
  assert.ok(body2.reply.length <= 8000, "Reply should be <= 8000 chars");
  assert.strictEqual(body2.truncated, true, "Should be marked truncated");
  assert.ok(body2.continuation_hint, "Should have continuation hint");
  console.log("PASS: Hard truncation enforced.");

  console.log("All tests passed!");
}

async function testErrorHandling() {
  console.log("Running Error Handling Tests...");
  
  const env = { GEMINI_API_KEY: "test-key-12345" };
  
  // TEST 3: Upstream 429 -> local fallback (200 UpstreamBusy)
  console.log("Test 3: Upstream 429 returns 200 UpstreamBusy fallback");
  
  mockResponses = Array.from({ length: 12 }, () => ({
    status: 429,
    body: { error: { code: 429, message: "Rate limited" } }
  }));

  const res3 = await worker.fetch(makeReq("Hello"), env);
  const body3 = await res3.json();
  
  assert.strictEqual(res3.status, 200, "Should return 200 when falling back locally");
  assert.strictEqual(body3.errorType, "UpstreamBusy", "Should have UpstreamBusy errorType");
  assert.strictEqual(body3.fallback_mode, true, "Should indicate fallback_mode");
  assert.ok(String(body3.reply).toLowerCase().includes("offline"), "Should mention offline fallback");
  console.log("PASS: 429 handled with local fallback.");

  // TEST 4: Upstream 403 -> 503 AuthError
  console.log("Test 4: Upstream 403 returns 503 AuthError");
  
  mockResponses = Array.from({ length: 12 }, () => ({
    status: 403,
    body: { error: { code: 403, message: "Forbidden" } }
  }));

  const res4 = await worker.fetch(makeReq("Hello"), env);
  const body4 = await res4.json();
  
  assert.strictEqual(res4.status, 503, "Should return 503 for upstream 403");
  assert.strictEqual(body4.errorType, "AuthError", "Should have AuthError errorType");
  console.log("PASS: 403 handled correctly.");

  // TEST 5: Timeout -> 504 Timeout
  console.log("Test 5: Timeout returns 504 Timeout");
  
  mockResponses = Array.from({ length: 12 }, () => ({
    throw: new Error("Request timeout")
  }));

  const res5 = await worker.fetch(makeReq("Hello"), env);
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
