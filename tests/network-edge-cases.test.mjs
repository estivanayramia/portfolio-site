import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const rootUrl = new URL('../', import.meta.url);

function sourceUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
}

async function loadContactModule() {
  const errorApiSource = await readFile(new URL('worker/error-api.js', rootUrl), 'utf8');
  const errorApiUrl = sourceUrl(errorApiSource);
  const dashboardSource = (await readFile(new URL('functions/_lib/dashboard-api.js', rootUrl), 'utf8'))
    .replace('../../worker/error-api.js', errorApiUrl);
  const dashboardUrl = sourceUrl(dashboardSource);
  const contactSource = (await readFile(new URL('functions/api/contact.js', rootUrl), 'utf8'))
    .replace('../_lib/dashboard-api.js', dashboardUrl);
  return import(sourceUrl(contactSource));
}

async function loadErrorApiModule() {
  const source = await readFile(new URL('worker/error-api.js', rootUrl), 'utf8');
  return import(sourceUrl(source));
}

test('contact receipt becomes upstream_failed when Formspree fetch throws', { concurrency: false }, async () => {
  const contact = await loadContactModule();
  const writes = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('synthetic upstream network failure'); };

  try {
    const formData = new FormData();
    formData.set('name', 'Network Edge');
    formData.set('email', 'edge@example.com');
    formData.set('message', 'Test the upstream failure state.');
    const request = new Request('https://www.estivanayramia.com/api/contact', {
      method: 'POST',
      body: formData,
    });
    const env = {
      SAVONIE_KV: {
        async put(key, value) {
          writes.push({ key, value: JSON.parse(value) });
        },
      },
    };

    const response = await contact.onRequest({ request, env });
    const body = await response.json();
    assert.ok(response.status >= 500 && response.status < 600);
    assert.equal(body.success, false);
    assert.equal(writes.at(-1)?.value?.state, 'upstream_failed');
    assert.equal(body.receiptId, writes.at(-1)?.value?.receiptId);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('contact receipt still becomes forwarded after confirmed delivery', { concurrency: false }, async () => {
  const contact = await loadContactModule();
  const writes = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: true, next: '/thanks' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });

  try {
    const formData = new FormData();
    formData.set('name', 'Delivery Baseline');
    formData.set('email', 'delivery@example.com');
    formData.set('message', 'Confirm the successful state.');
    const request = new Request('https://www.estivanayramia.com/api/contact', {
      method: 'POST',
      body: formData,
    });
    const env = {
      SAVONIE_KV: {
        async put(key, value) {
          writes.push({ key, value: JSON.parse(value) });
        },
      },
    };

    const response = await contact.onRequest({ request, env });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(writes.at(-1)?.value?.state, 'forwarded');
    assert.equal(body.receiptId, writes.at(-1)?.value?.receiptId);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('error list rejects non-positive and non-numeric limits before D1', async () => {
  const { apiHandleGetErrors } = await loadErrorApiModule();

  for (const limit of ['-1', 'abc']) {
    let prepared = false;
    const env = {
      SAVONIE_KV: {
        async get(key) {
          return key.startsWith('sess:') ? { created: Date.now() } : null;
        },
        async put() {},
      },
      DB: {
        prepare() {
          prepared = true;
          throw new Error('D1 must not receive an invalid limit');
        },
      },
    };
    const request = new Request(`https://www.estivanayramia.com/api/errors?limit=${limit}`, {
      headers: { Authorization: 'Bearer qa-session' },
    });

    const response = await apiHandleGetErrors(request, env, []);
    assert.equal(response.status, 400, `limit=${limit}`);
    assert.equal(prepared, false, `limit=${limit}`);
  }
});

test('error list keeps valid paging bounded before D1', async () => {
  const { apiHandleGetErrors } = await loadErrorApiModule();
  let boundPaging = null;
  const env = {
    SAVONIE_KV: {
      async get(key) {
        return key.startsWith('sess:') ? { created: Date.now() } : null;
      },
      async put() {},
    },
    DB: {
      prepare(sql) {
        if (sql.includes('COUNT(*)')) {
          return { async all() { return { results: [{ c: 0 }] }; } };
        }
        return {
          bind(...values) {
            boundPaging = values;
            return { async all() { return { results: [] }; } };
          },
        };
      },
    },
  };
  const request = new Request('https://www.estivanayramia.com/api/errors?limit=999&offset=3', {
    headers: { Authorization: 'Bearer qa-session' },
  });

  const response = await apiHandleGetErrors(request, env, []);
  assert.equal(response.status, 200);
  assert.deepEqual(boundPaging, [200, 3]);
});

test('stale chat manifest falls back when live crawl fetch never settles', { concurrency: false }, async () => {
  globalThis.__savonieGroundingCache = {
    profile: null,
    profileTimestamp: 0,
    facts: null,
    factsTimestamp: 0,
    manifest: null,
    manifestTimestamp: 0,
  };
  const chatService = await import(`../worker/chat-service.mjs?edge=${Date.now()}`);
  const staleManifest = {
    version: 'page-grounding-v1',
    source: 'test-stale',
    buildVersion: 'old-build',
    refreshedAt: '2020-01-01T00:00:00.000Z',
    pages: [{
      route: '/',
      canonical: '/',
      title: 'Home',
      description: 'Portfolio home',
      headings: ['Home'],
      keywords: ['home'],
      links: [],
      sections: [{ heading: 'Home', level: 1, text: 'Portfolio home', keywords: ['home'] }],
    }],
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {});

  try {
    const pending = chatService.prepareChatContext({
      env: {
        __PAGE_MANIFEST: staleManifest,
        __CHAT_MANIFEST_REFRESH_TIMEOUT_MS: 50,
      },
      request: new Request('https://www.estivanayramia.com/chat'),
      message: 'What projects has Estivan done?',
      language: 'en',
      rawPageContext: { route: '/', buildVersion: 'new-build' },
      legacyPageContent: '',
    });
    const result = await Promise.race([
      pending,
      new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), 250)),
    ]);

    assert.notEqual(result.timedOut, true);
    assert.equal(result.manifestStatus, 'stale_manifest');
    assert.equal(result.manifest.buildVersion, 'old-build');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
