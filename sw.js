// ==========================================================================
// Service Worker Configuration
// ==========================================================================
// Caching Strategy:
//   - HTML (navigation): Network-first, fallback to cache, then 404
//   - Static Assets (CSS/JS/images): Stale-while-revalidate
//
// Cache Version: Bump this whenever you deploy changes that affect cached files
// ==========================================================================
const CACHE_VERSION = 'v1767229951';
const CACHE_NAME = `portfolio-${CACHE_VERSION}`;
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/about.html',
    '/overview.html',
    '/deep-dive.html',
    '/projects.html',
    '/contact.html',
    '/privacy.html',
    '/404.html',
    '/assets/css/theme.css',
    '/assets/css/style.css',
    '/assets/js/site.js',
    '/assets/js/lazy-loader.js',
    '/assets/js/contact-form.js',
    '/assets/img/headshot.webp',
    '/assets/img/savonie-thumb.webp'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching files');
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .finally(() => self.skipWaiting())
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
            .finally(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
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
                    return cached || caches.match('/404.html');
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
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                        }
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

// Optional: Listen for messages to trigger skipWaiting from page
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
