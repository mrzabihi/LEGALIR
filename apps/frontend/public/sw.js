/* ============================================================
   LEGALIR — Service Worker
   ============================================================
   Scope: static, public assets only.

   HARD RULE — never cache:
     • API responses (/api/*),
     • documents, contracts, account data, tokens, or any user PII,
     • anything served from a non-GET request.
   Only same-origin GET requests for static assets (JS/CSS/fonts/images) and
   the offline fallback page are cached. Navigation requests are network-first
   so a signed-in user always sees fresh, server-rendered content; when the
   network is unavailable they fall back to the Persian offline page.

   Update model: the page (service-worker-registrar.tsx) detects a waiting
   worker and asks the user before activating it, so an unsaved form is never
   wiped by a surprise reload. `skipWaiting` runs only on that explicit
   message. Old caches are pruned on activation.
   ============================================================ */

const VERSION = "v1";
const STATIC_CACHE = `legalir-static-${VERSION}`;
const OFFLINE_URL = "/offline.html";

/* Precache the offline page and the app icons so the fallback and the
   installed-app chrome work with no network. */
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.json",
];

/* Static asset extensions we are willing to cache. */
const STATIC_DESTINATIONS = new Set(["style", "script", "font", "image"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => undefined)
  );
  // Do NOT skipWaiting here — the page decides when to activate.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache that is not the current version.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("legalir-") && key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
      // Take control of open pages so the new worker serves them.
      await self.clients.claim();
    })()
  );
});

/* The page sends this only after the user accepts the update. */
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/** True for requests we must never touch (API, auth, non-GET, cross-origin). */
function isUncacheable(request, url) {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (url.pathname.startsWith("/api/")) return true;
  // Never cache the service worker or its own scope plumbing.
  if (url.pathname === "/sw.js") return true;
  return false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (isUncacheable(request, url)) return; // let the network handle it

  // --- Navigations: network-first, offline fallback -------------------
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return (
            offline ||
            new Response("آفلاین", {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          );
        }
      })()
    );
    return;
  }

  // --- Static assets: stale-while-revalidate --------------------------
  if (STATIC_DESTINATIONS.has(request.destination)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            // Only cache successful, same-origin, non-opaque responses.
            if (response && response.status === 200 && response.type === "basic") {
              cache.put(request, response.clone()).catch(() => undefined);
            }
            return response;
          })
          .catch(() => undefined);
        return cached || (await network) || Response.error();
      })()
    );
  }
});
