/**
 * Service Worker — safe caching strategy.
 * ONLY caches the app shell and static assets.
 * NEVER caches API responses, vault content, or decrypted data.
 * Quick Exit must work offline — /dashboard is pre-cached.
 */

const CACHE_NAME = "daybook-shell-v1";

// App shell: static routes and assets only
const SHELL_URLS = [
  "/",
  "/login",
  "/dashboard",
  "/manifest.json",
];

// ─── Install: pre-cache app shell ────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_URLS).catch((err) => {
        console.warn("[SW] Pre-cache partial failure:", err);
      });
    })
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch: network-first for API, cache-first for shell ─────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never cache API responses — always go to network
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })));
    return;
  }

  // Never cache vault/tools routes (content is sensitive)
  if (
    url.pathname.startsWith("/tools/") ||
    url.pathname.startsWith("/onboarding")
  ) {
    event.respondWith(fetch(request).catch(() => {
      return caches.match("/dashboard") ?? new Response("Offline", { status: 503 });
    }));
    return;
  }

  // For Next.js static chunks (_next/static): cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached ?? fetch(request).then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        });
      })
    );
    return;
  }

  // App shell pages: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return res;
      })
      .catch(() => caches.match(request).then((c) => c ?? new Response("Offline", { status: 503 })))
  );
});
