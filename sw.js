// ==========================================================================
// Service Worker Configuration
// ==========================================================================
// Caching Strategy:
//   - HTML (navigation): Network-first, fallback to cache, then 404
//   - Static Assets (CSS/JS/images): Stale-while-revalidate
//
// Cache Version: Bump this whenever you deploy changes that affect cached files
// ==========================================================================
const CACHE_VERSION = 'v1769316949007';
const CACHE_NAME = `portfolio-${CACHE_VERSION}`;
const ASSETS_TO_CACHE = [
    '/',
    '/about',
    '/contact',
    '/deep-dive',
    '/projects/',
    '/hobbies/',
    '/hobbies-games',
    '/privacy',
    '/overview',
    '/EN/404.html',
    `/theme.css?v=${CACHE_VERSION}`,
    '/assets/css/style.css',
    '/assets/fonts/inter/inter-latin.woff2',
    '/assets/js/site.js',
    '/assets/js/site.min.js',
    '/assets/js/lazy-loader.min.js',
    '/assets/js/cache-refresh.js',
    '/assets/js/contact-form.js',
    '/assets/img/headshot.webp',
    '/assets/img/savonie-thumb.webp'
];

// Allow the page to trigger immediate activation when a new SW is waiting.
self.addEventListener('message', (event) => {
    if (!event?.data || typeof event.data !== 'object') return;
    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

let isRefreshing = false;
self.addEventListener('controllerchange', () => {
    if (isRefreshing) return;
    isRefreshing = true;
    // Clients will reload themselves if they are monitoring controllerchange,
    // but the SW itself usually doesn't force reload unless via postMessage logic handled in client.
});

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);

    // Never cache API or health checks
    if (requestUrl.origin === self.location.origin) {
        if (requestUrl.pathname.startsWith('/api/') || requestUrl.pathname === '/health') {
            event.respondWith(fetch(event.request));
            return;
        }
    }

    // Skip non-GET requests
    if (event.request.method !== 'GET') return;

    // Skip external requests (CDN, APIs, etc.)
    if (!event.request.url.startsWith(self.location.origin)) return;

    const request = event.request;
    const isHTML = request.destination === 'document' || request.headers.get('accept')?.includes('text/html');

    // Strategy:
    // - HTML: network-first (ensures latest code after deploy), fallback to cache/404
    // - Assets (CSS/JS/images): stale-while-revalidate
    if (isHTML) {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    // Cache the latest HTML
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(request);
                    return cached || caches.match('/EN/404.html');
                })
        );
        return;
    }

    // Stale-while-revalidate for assets
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                const networkFetch = fetch(request)
                    .then((response) => {
                        // Guard: Don't cache if response is not 200 OK
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        // Guard: Don't cache HTML 404s served as 200s for non-HTML requests
                        // (Cloudflare Pages catch-all returns 200 OK with HTML for missing assets)
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.includes('text/html')) {
                            // If we expected an asset but got HTML, do not cache it.
                            return response;
                        }

                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                        
                        return response;
                    })
                    .catch(() => undefined);

                // If cache exists, return it immediately and update in background
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Otherwise, return network response (or fail)
                return networkFetch;
            })
    );
});

