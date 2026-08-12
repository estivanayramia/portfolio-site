// ==========================================================================
// Service Worker Configuration
// ==========================================================================
// Strategy:
// - HTML/navigation: network-first, fallback to cache, then 404
// - Static assets: stale-while-revalidate
//
// Precache only real clean routes and real asset paths.
// Do not let one failed precache request abort install.
// ==========================================================================
const CACHE_VERSION = 'v20260812-6b76d5f2';
const CACHE_PREFIX = 'portfolio-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',
  '/about',
  '/overview',
  '/deep-dive',
  '/projects/',
  '/contact',
  '/privacy',
  '/es/',
  '/ar/',
  '/404.html',
  '/assets/css/style.css',
  '/theme.css',
  '/assets/js/site.min.js',
  '/assets/js/lazy-loader.min.js',
  '/assets/img/headshot.webp',
  '/assets/img/logo-ea.webp',
  '/assets/img/savonie-thumb.webp'
];

async function precacheAll() {
  const cache = await caches.open(CACHE_NAME);
  const results = await Promise.allSettled(
    PRECACHE_URLS.map(async (url) => {
      const request = new Request(url, { cache: 'reload' });
      const response = await fetch(request);
      if (!response.ok) {
        throw new Error(`${url} -> HTTP ${response.status}`);
      }
      await cache.put(request, response);
    })
  );

  const failures = results
    .map((result, index) => ({ result, url: PRECACHE_URLS[index] }))
    .filter(({ result }) => result.status === 'rejected');

  if (failures.length > 0) {
    console.warn(
      '[sw] Precache completed with failures:',
      failures.map(({ url, result }) => `${url}: ${result.reason?.message || result.reason}`)
    );
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precacheAll());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => Promise.all(
        cacheNames.map((cache) => {
          if (cache.startsWith(CACHE_PREFIX) && cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
          return undefined;
        })
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return;

  const request = event.request;
  const accept = request.headers.get('accept') || '';
  const isHTML = request.destination === 'document' || accept.includes('text/html');
  const isStaticAsset =
    request.destination === 'style'
    || request.destination === 'script'
    || request.destination === 'image'
    || request.destination === 'font';

  if (isHTML) {
    const networkResult = fetch(request).then((response) => ({
      cacheResponse: response.ok ? response.clone() : null,
      response
    }));
    event.waitUntil(
      networkResult
        .then(async ({ cacheResponse }) => {
          if (!cacheResponse) return;
          const cache = await caches.open(CACHE_NAME);
          await cache.put(request, cacheResponse);
        })
        .catch(() => undefined)
    );
    event.respondWith(
      networkResult
        .then(({ response }) => response)
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          return cached || caches.match('/404.html');
        })
    );
    return;
  }

  const networkResult = fetch(request)
    .then((response) => ({
      cacheResponse: response.status === 200 ? response.clone() : null,
      response
    }))
    .catch(() => undefined);
  event.waitUntil(
    networkResult.then(async (result) => {
      if (!result?.cacheResponse) return;
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, result.cacheResponse);
    })
  );
  event.respondWith(
    caches.match(request, { ignoreSearch: isStaticAsset })
      .then((cachedResponse) => cachedResponse || networkResult.then((result) => result?.response))
  );
});
