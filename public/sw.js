/**
 * Service Worker — safe caching strategy.
 * ONLY caches the app shell and static assets.
 * NEVER caches API responses, vault content, or decrypted data.
 * Quick Exit must work offline — /dashboard is pre-cached.
 */

// v3: SW now ignores cross-origin/non-GET requests entirely. The bump drops
// caches written by older versions whose catch-all could store cross-origin
// responses (e.g. encrypted media downloads) in Cache Storage.
const CACHE_NAME = "bellemeadow-wellness-shell-v3";

// App shell: static routes and assets only. /dashboard is intentionally NOT
// pre-cached because it is server-rendered with the current session — caching
// the HTML risks cross-contaminating FULL vs DECOY state or different users
// on shared devices on subsequent offline loads.
const SHELL_URLS = [
  "/",
  "/login",
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

  // Only manage same-origin GETs. Anything else (Supabase REST/storage,
  // mutations) streams straight to the network: the catch-all below must never
  // persist vault ciphertext or signed-URL responses into Cache Storage, and
  // cache.put() on non-GET requests throws anyway.
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Never cache API responses — always go to network
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ error: "Offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    })));
    return;
  }

  // Never cache vault/tools routes or the per-user dashboard
  // (content is sensitive / session-dependent).
  if (
    url.pathname.startsWith("/tools/") ||
    url.pathname.startsWith("/onboarding") ||
    url.pathname === "/dashboard" ||
    url.pathname.startsWith("/dashboard/")
  ) {
    // caches.match returns a Promise, so the fallback must live inside .then —
    // `caches.match("/") ?? x` is always the promise and can resolve undefined,
    // which makes respondWith fail with a network error instead of this page.
    event.respondWith(fetch(request).catch(() => {
      return caches.match("/").then((cached) => cached ?? new Response("Offline", { status: 503 }));
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
