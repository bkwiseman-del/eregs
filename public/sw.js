// eRegs Service Worker — hand-rolled, no Workbox
const CACHE_VERSION = "eregs-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

const OFFLINE_URL = "/offline";

// ── Install: pre-cache offline page ──
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ──
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("eregs-") &&
              key !== STATIC_CACHE &&
              key !== DATA_CACHE &&
              key !== IMAGE_CACHE
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch handler ──
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET
  if (event.request.method !== "GET") return;

  // Skip API routes handled by client IDB or network-only
  if (
    url.pathname.startsWith("/api/annotations") ||
    url.pathname.startsWith("/api/insights") ||
    url.pathname.startsWith("/api/auth") ||
    url.pathname.startsWith("/api/ai-chat") ||
    url.pathname.startsWith("/api/search") ||
    url.pathname.startsWith("/api/historical-section") ||
    url.pathname.startsWith("/api/section-history") ||
    url.pathname.startsWith("/api/dashboard")
  ) {
    return;
  }

  // ── Static assets: cache-first (immutable) ──
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // ── Reader data API: stale-while-revalidate ──
  if (url.pathname === "/api/reader-data") {
    event.respondWith(
      caches.open(DATA_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          const fetchPromise = fetch(event.request)
            .then((response) => {
              if (response.ok) {
                cache.put(event.request, response.clone());
                // Notify clients that fresh data arrived
                const part = url.searchParams.get("part");
                self.clients.matchAll().then((clients) => {
                  clients.forEach((client) =>
                    client.postMessage({ type: "READER_DATA_UPDATED", part })
                  );
                });
              }
              return response;
            })
            .catch(() => {
              // Network failed — cached version already returned above
              return (
                cached ||
                new Response(
                  JSON.stringify({ error: "Offline", offline: true }),
                  {
                    status: 503,
                    headers: { "Content-Type": "application/json" },
                  }
                )
              );
            });

          // Return cached immediately if available, otherwise wait for network
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // ── eCFR images: cache-first ──
  if (url.pathname === "/api/ecfr-image") {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // ── Google Fonts: cache-first ──
  if (
    url.hostname === "fonts.googleapis.com" ||
    url.hostname === "fonts.gstatic.com"
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) return cached;
          return fetch(event.request).then((response) => {
            if (response.ok) cache.put(event.request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // ── HTML page navigations: network-first, offline fallback ──
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful /regs/* page loads for offline access
          if (response.ok && url.pathname.startsWith("/regs/")) {
            caches
              .open(STATIC_CACHE)
              .then((c) => c.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(event.request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
        )
    );
    return;
  }
});

// ── Message handling from client ──
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  // Client requests pre-caching of a specific part (for "Download All")
  if (event.data?.type === "CACHE_PART") {
    const part = event.data.part;
    const cacheUrl = `/api/reader-data?part=${part}`;
    caches
      .open(DATA_CACHE)
      .then((cache) =>
        fetch(cacheUrl)
          .then((response) => {
            if (response.ok) {
              cache.put(new Request(cacheUrl), response.clone());
              event.source?.postMessage({ type: "PART_CACHED", part });
            }
          })
          .catch(() => {
            event.source?.postMessage({ type: "PART_CACHE_FAILED", part });
          })
      );
  }
});
