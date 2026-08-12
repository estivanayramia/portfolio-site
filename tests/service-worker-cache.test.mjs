import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const SOURCE = fs.readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
const CACHE_VERSION = SOURCE.match(/CACHE_VERSION\s*=\s*['"]([^'"]+)['"]/u)?.[1];
assert.ok(CACHE_VERSION, 'sw.js must declare CACHE_VERSION');
const CURRENT_CACHE = `portfolio-${CACHE_VERSION}`;

function request(url, { destination = '', accept = '*/*' } = {}) {
  return {
    method: 'GET',
    url,
    destination,
    headers: new Headers({ accept })
  };
}

function cacheKey(value) {
  return typeof value === 'string' ? value : value.url;
}

function createHarness({ fetchImpl, cachePutDelayMs = 0, initialCaches = [] } = {}) {
  const listeners = new Map();
  const stores = new Map(initialCaches.map((name) => [name, new Map()]));
  const deletedCaches = [];
  let cachePutCompleted = false;

  const cacheFor = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return {
      async put(key, response) {
        if (cachePutDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, cachePutDelayMs));
        }
        stores.get(name).set(cacheKey(key), response);
        cachePutCompleted = true;
      },
      async match(key) {
        return stores.get(name).get(cacheKey(key));
      }
    };
  };

  const caches = {
    open: async (name) => cacheFor(name),
    keys: async () => [...stores.keys()],
    delete: async (name) => {
      deletedCaches.push(name);
      return stores.delete(name);
    },
    match: async (key) => {
      const normalized = cacheKey(key);
      for (const store of stores.values()) {
        if (store.has(normalized)) return store.get(normalized);
      }
      return undefined;
    }
  };

  const self = {
    location: { origin: 'https://portfolio.test' },
    clients: { claim: async () => undefined },
    skipWaiting() {},
    addEventListener(type, listener) {
      listeners.set(type, listener);
    }
  };

  const context = vm.createContext({
    caches,
    console,
    fetch: fetchImpl || (async () => new Response('ok', { status: 200 })),
    Headers,
    Promise,
    Request,
    Response,
    self,
    setTimeout,
    URL
  });
  vm.runInContext(SOURCE, context, { filename: 'sw.js' });

  return {
    cachePutCompleted: () => cachePutCompleted,
    deletedCaches,
    listeners,
    stores
  };
}

function dispatchFetch(harness, value) {
  let responsePromise;
  const lifetimePromises = [];
  const event = {
    request: value,
    respondWith(promise) {
      responsePromise = Promise.resolve(promise);
    },
    waitUntil(promise) {
      lifetimePromises.push(Promise.resolve(promise));
    }
  };
  harness.listeners.get('fetch')(event);
  return {
    lifetimePromise: Promise.all(lifetimePromises),
    responsePromise
  };
}

test('bypasses every same-origin API GET so private responses never enter Cache Storage', async () => {
  let fetchCalls = 0;
  const harness = createHarness({
    fetchImpl: async () => {
      fetchCalls += 1;
      return new Response('{"private":true}', { status: 200 });
    }
  });

  const { responsePromise } = dispatchFetch(harness, request('https://portfolio.test/api/errors'));

  assert.equal(responsePromise, undefined);
  assert.equal(fetchCalls, 0);
  assert.equal([...harness.stores.values()].reduce((count, store) => count + store.size, 0), 0);
});

test('ignores cross-origin requests whose host only starts with the site origin text', () => {
  const harness = createHarness();
  const { responsePromise } = dispatchFetch(
    harness,
    request('https://portfolio.test.evil.example/assets/tracker.js', { destination: 'script' })
  );

  assert.equal(responsePromise, undefined);
});

test('keeps successful navigation alive until its cache write finishes', async () => {
  const harness = createHarness({ cachePutDelayMs: 50 });
  const { lifetimePromise, responsePromise } = dispatchFetch(
    harness,
    request('https://portfolio.test/about', { destination: 'document', accept: 'text/html' })
  );

  const response = await responsePromise;
  await lifetimePromise;

  assert.equal(response.status, 200);
  assert.equal(harness.cachePutCompleted(), true);
});

test('does not cache non-OK HTML responses', async () => {
  const harness = createHarness({
    fetchImpl: async () => new Response('temporary failure', { status: 500 })
  });
  const { lifetimePromise, responsePromise } = dispatchFetch(
    harness,
    request('https://portfolio.test/about', { destination: 'document', accept: 'text/html' })
  );

  const response = await responsePromise;
  await lifetimePromise;
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.equal(response.status, 500);
  assert.equal([...harness.stores.values()].reduce((count, store) => count + store.size, 0), 0);
});

test('activation deletes only older portfolio caches and preserves foreign caches', async () => {
  const harness = createHarness({
    initialCaches: [
      'portfolio-v20240101-old',
      CURRENT_CACHE,
      'third-party-widget-cache'
    ]
  });
  let activation;
  harness.listeners.get('activate')({
    waitUntil(promise) {
      activation = Promise.resolve(promise);
    }
  });

  await activation;

  assert.deepEqual(harness.deletedCaches, ['portfolio-v20240101-old']);
  assert.equal(harness.stores.has('third-party-widget-cache'), true);
});
