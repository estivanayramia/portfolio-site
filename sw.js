/* sw.js */
// Service worker caching for public pages only.
// Strictly bypasses the dashboard + diagnostics + all /api/* routes to avoid preview/prod auth surprises.

const CACHE_VERSION = 'v20260227-74d93f5-dashboard-bypass';
const CACHE_PREFIX = 'portfolio-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;

// Keep this list lean. Do NOT precache dashboard or any diagnostics scripts.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/css/style.css',
  '/theme.css',
  '/assets/js/site.min.js',
  '/assets/js/lazy-loader.min.js',
  '/assets/js/cache-refresh.js',
  '/assets/img/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_URLS);
    })()
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
      await self.clients.claim();
    })()
  );
});

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isHTMLRequest(request) {
  return request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html');
}

function shouldBypass(url) {
  const path = url.pathname;

  // Never cache API responses.
  if (path.startsWith('/api/')) return true;

  // Never cache the dashboard entrypoint (Pages rewrites /dashboard -> /EN/dashboard.html).
  if (path === '/dashboard' || path === '/dashboard/' || path === '/EN/dashboard.html') return true;

  // Never cache dashboard assets.
  if (path === '/assets/js/dashboard.js' || path === '/assets/css/dashboard.css') return true;

  // Never cache diagnostics/HUD scripts.
  if (path.startsWith('/assets/js/telemetry-core')) return true;
  if (path.startsWith('/assets/js/diagnostics-consent')) return true;
  if (path.startsWith('/assets/js/debugger-hud')) return true;

  return false;
}

async function putInCache(request, response) {
  if (!response || !response.ok) return;
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, response);
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await putInCache(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await putInCache(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  if (shouldBypass(url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (isHTMLRequest(request)) {
    event.respondWith(
      networkFirst(request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  const dest = request.destination;
  if (dest === 'style' || dest === 'script' || dest === 'image' || dest === 'font') {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default: don't interfere.
  event.respondWith(fetch(request));
});

