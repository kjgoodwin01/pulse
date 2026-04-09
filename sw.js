const CACHE = "pulse-v3";
const ASSETS = ["/pulse/", "/pulse/index.html", "/pulse/manifest.json"];

// Install: cache core assets
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: delete ALL old caches immediately
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Fetch: network-first for HTML (always get latest), cache-first for everything else
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  // Always go network-first for the main HTML page
  if (url.pathname === "/pulse/" || url.pathname === "/pulse/index.html" || url.pathname.endsWith(".html")) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for everything else (fonts, CDN scripts, icons)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      });
    })
  );
});

// Listen for SKIP_WAITING message from the page
self.addEventListener("message", e => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});
