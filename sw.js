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
const CACHE_VERSION = 'v20260420-914d509e-dashboard-bypass';
const CACHE_NAME = `portfolio-${CACHE_VERSION}`;

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
          if (cache !== CACHE_NAME) {
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
  if (!event.request.url.startsWith(self.location.origin)) return;

  const request = event.request;
  const accept = request.headers.get('accept') || '';
  const isHTML = request.destination === 'document' || accept.includes('text/html');
  const isStaticAsset =
    request.destination === 'style'
    || request.destination === 'script'
    || request.destination === 'image'
    || request.destination === 'font';

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          return cached || caches.match('/404.html');
        })
    );
    return;
  }

  event.respondWith(
    caches.match(request, { ignoreSearch: isStaticAsset })
      .then((cachedResponse) => {
        const networkFetch = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => undefined);

        if (cachedResponse) {
          return cachedResponse;
        }

        return networkFetch;
      })
  );
});
