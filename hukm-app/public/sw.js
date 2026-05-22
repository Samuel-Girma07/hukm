/**
 * HUKM — Service Worker.
 *
 * Strategies:
 *   - /_next/static/*   → cache-first (immutable, fingerprinted assets).
 *   - everything else   → network-first; on failure, fall back to the
 *                         cached copy or to /offline.
 *
 * Versioning: bump CACHE_VERSION whenever the static asset surface
 * changes in a way that would break older clients. Old caches are
 * pruned on `activate`.
 */

const CACHE_VERSION = "hukm-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        OFFLINE_URL,
        "/manifest.json",
        "/icons/icon-192.svg",
        "/icons/icon-512.svg",
      ]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  // Skip cross-origin and non-http(s) requests entirely.
  if (url.origin !== self.location.origin) return;

  // Cache-first for /_next/static/*.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
          return response;
        });
      }),
    );
    return;
  }

  // Don't intercept API calls — they need to be live.
  if (url.pathname.startsWith("/api/")) return;

  // Network-first for everything else.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
        }
        return new Response("", { status: 504, statusText: "Offline" });
      }),
  );
});
