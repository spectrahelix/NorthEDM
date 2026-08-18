// NorthEDM service worker — installability + light offline support.
//
// Hardened against the "loads after a deploy but nothing is tappable" failure:
// the app shell is never served stale. Pages are network-first (always fresh
// when online), the cache name is tied to the build version passed in the
// registration URL (?v=…) so every deploy purges the previous caches on
// activate, and the new worker takes over immediately (skipWaiting +
// clients.claim). The page-side registration reloads once on controllerchange
// so the HTML and its hashed JS always come from the same build.
//
// Auth/API requests are never cached. Static assets are content-hashed by
// Next.js (unique filename per build), so cache-first on them can never go
// stale — a new build simply requests new filenames.

const VERSION = new URL(self.location.href).searchParams.get("v") || "static";
const CACHE = `northedm-${VERSION}`;
const PRECACHE = ["/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Speed up navigations with navigation preload where supported.
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch { /* ignore */ }
      }
      // Drop every cache that isn't this build's — this is what makes a deploy
      // actually evict the old app shell.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Let the page trigger an immediate takeover if it wants to.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/auth")) return;

  // Pages: network-first (prefer the preloaded response), fall back to cache,
  // then the offline page. Fresh HTML whenever there's a network.
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse;
          const res = preloaded || (await fetch(req));
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        } catch {
          return (await caches.match(req)) || (await caches.match("/offline"));
        }
      })()
    );
    return;
  }

  // Static assets (content-hashed → safe cache-first).
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons")) {
    event.respondWith(
      caches.match(req).then((r) =>
        r || fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
      )
    );
  }
});
