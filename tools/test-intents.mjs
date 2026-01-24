import assert from 'node:assert/strict';
import worker from '../worker/worker.js';

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeWord(text, word) {
  const re = new RegExp(`\\b${escapeRegExp(word)}\\b`, 'i');
  return re.test(String(text));
}

function makeReq(message) {
  return new Request('http://localhost/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': '127.0.0.1',
      Origin: 'http://localhost'
    },
    body: JSON.stringify({
      message,
      language: 'en',
      pageContent: 'path: /\ntitle: test'
    })
  });
}

async function run() {
  console.log('🧪 Testing Savonie intent word-boundary behavior...\n');

  // Force deterministic pathing: no KV, no real Gemini.
  const env = { SAVONIE_KV: null, GEMINI_API_KEY: '' };

  // 1) "rate" should trigger salary (including punctuation)
  {
    const res = await worker.fetch(makeReq('What is your rate??'), env);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.errorType, null);
    assert.ok(String(body.reply).toLowerCase().includes('compensation'));
    console.log('✅ rate?? -> salary canned response');
  }

  // 2) "corporate" should NOT trigger salary (previously matched "rate")
  {
    const res = await worker.fetch(makeReq('Tell me about corporate, strategy.'), env);
    const body = await res.json();

    // With no GEMINI_API_KEY, non-canned queries should fail fast with ConfigError.
    assert.equal(res.status, 503);
    assert.equal(body.errorType, 'ConfigError');
    console.log('✅ corporate (no false match) -> ConfigError without Gemini');
  }

  // 2b) General word-boundary regression: "translate" must NOT match "late"
  {
    assert.equal(hasWholeWord('translate', 'late'), false);
    assert.equal(hasWholeWord('it is late.', 'late'), true);
    console.log('✅ translate vs late boundary regression');
  }

  // 3) Contact intent should still be caught by word match (including punctuation)
  {
    const res = await worker.fetch(makeReq('How can I contact you?!'), env);
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.errorType, null);
    assert.ok(String(body.reply).includes('hello@estivanayramia.com'));
    assert.ok(!String(body.reply).includes('mailto:'));
    console.log('✅ contact -> canned reply without mailto');
  }

  console.log('\nAll intent tests passed.');
}

run().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
