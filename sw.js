/* sw.js */
const CACHE_VERSION = "v20260127-telemetry";
const CACHE_NAME = `portfolio-cache-${CACHE_VERSION}`;

// Keep this list lean. Do NOT precache HUD or any debug scripts.
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/manifest.json",
  "/assets/css/style.css",
  "/theme.css",
  "/assets/js/site.min.js",
  "/assets/js/lazy-loader.min.js",
  "/assets/js/cache-refresh.js",
  "/assets/img/logo-ea.webp",
  "/assets/img/favicon-32x32.png",
  "/assets/img/favicon-16x16.png",
  "/assets/img/apple-touch-icon.png",
  "/assets/img/favicon.ico"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name.startsWith("portfolio-cache-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

function isHTMLRequest(request) {
  return request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html");
}

function isHUDAsset(url) {
  return url.pathname === "/assets/js/debugger-hud.min.js";
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Always network-first for HTML and the HUD script (HUD is versioned by query param).
  if (isHTMLRequest(event.request) || isHUDAsset(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      });
    })
  );
});
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
                        if (response && response.status === 200) {
                            const responseClone = response.clone();
                            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
                        }
                        return response;
                    })
                    .catch(() => undefined);

