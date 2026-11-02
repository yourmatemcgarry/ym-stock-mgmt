/* Coldroom — keeping the app usable where there is no signal.

   The coldroom has no internet. Without this, a refresh down there gives a
   dead browser page and the morning stops. The page itself and its data file
   are kept in a cache: the network is tried first so a new build is picked up
   the moment there is a connection, and the cached copy is only used when the
   network cannot answer.

   The database is never cached. Reads need a connection; writes are queued on
   the device by the app's own outbox and go up when the signal returns. */

const CACHE = "coldroom-shell-v1";
const SHELL = ["/", "/index.html", "/seed.json", "/seed-version.json"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;       /* the outbox handles this */

  e.respondWith((async () => {
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.ok) {
        const c = await caches.open(CACHE);
        c.put(req.mode === "navigate" ? "/index.html" : req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      const c = await caches.open(CACHE);
      const hit = await c.match(req.mode === "navigate" ? "/index.html" : req);
      if (hit) return hit;
      throw err;
    }
  })());
});
