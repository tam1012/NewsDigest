/**
 * NewsDigest Service Worker — Runtime Caching
 *
 * Strategy:
 *  - App shell (HTML, JS, CSS, fonts, icons): Cache-first, update in background
 *  - Navigation requests (/  /?date=...): Always serve cached index.html
 *  - API calls (/api/*): Network-first, fail silently offline (app reads IndexedDB)
 *  - Everything else: Network-first with cache fallback
 *
 * Cache versioning: bump CACHE_VERSION to force-clear old caches on next deploy.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `newsdigest-shell-${CACHE_VERSION}`;

// ── Helpers ─────────────────────────────────────────────

function isApiRequest(url) {
  return url.pathname.startsWith('/api/');
}

function isNavigationRequest(request) {
  return request.mode === 'navigate';
}

function isAppShellAsset(url) {
  // SvelteKit immutable assets (hashed JS/CSS bundles)
  if (url.pathname.startsWith('/_app/')) return true;
  // Static assets: fonts, icons, manifest
  const staticExts = ['.js', '.css', '.png', '.ico', '.ttf', '.woff', '.woff2', '.webp', '.svg', '.json'];
  return staticExts.some((ext) => url.pathname.endsWith(ext));
}

function isCacheable(request, response) {
  if (request.method !== 'GET') return false;
  if (!response || !response.ok) return false;
  // Don't cache opaque responses (cross-origin without CORS)
  if (response.type === 'opaque') return false;
  return true;
}

// ── Install ──────────────────────────────────────────────

self.addEventListener('install', (event) => {
  // Precache the HTML shell immediately on install.
  // This ensures the app works offline after the very first online visit,
  // without requiring a second navigation to trigger runtime caching.
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // Fetch and store the root shell. Use cache:'reload' to bypass any
      // browser HTTP cache so we always get a fresh copy from the server.
      fetch('/', { cache: 'reload' })
        .then((response) => {
          if (response.ok) return cache.put('/', response);
        })
        .catch(() => {
          // SW installed while offline — fine, runtime caching will fill the gap
          // when the user is next online.
        })
    ).then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete old cache versions
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('newsdigest-') && key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      );
      // Take control of all open tabs immediately
      await self.clients.claim();
    })()
  );
});

// ── Fetch ─────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ignore non-http(s) requests (e.g. chrome-extension://)
  if (!url.protocol.startsWith('http')) return;

  // ── API: Network-first, no caching ──────────────────────
  // App reads IndexedDB when network is unavailable — no fallback needed here.
  if (isApiRequest(url)) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return a valid JSON "offline" response so the app doesn't crash
        return new Response(
          JSON.stringify({ offline: true, articles: [], total: 0, digest: null }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      })
    );
    return;
  }

  // ── Navigation: serve cached shell ──────────────────────
  // SvelteKit is a SPA — ALL navigations should return the same index.html.
  // The client-side router handles routing from there.
  if (isNavigationRequest(event.request)) {
    event.respondWith(
      (async () => {
        // Try network first (to get fresh HTML), cache the result
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            const cache = await caches.open(SHELL_CACHE);
            // Cache the root URL as our shell fallback
            cache.put(new Request('/'), networkResponse.clone());
            return networkResponse;
          }
        } catch {
          // Offline — fall through to cache
        }
        // Serve cached shell for any navigation URL
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match('/');
        if (cached) return cached;

        // Nothing in cache yet (very first load offline) — can't do anything
        return new Response('App not available offline yet. Please open once while online.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' },
        });
      })()
    );
    return;
  }

  // ── Static assets: Cache-first, update in background ────
  if (isAppShellAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(event.request);

        // Fetch from network (background, regardless of cache hit)
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (isCacheable(event.request, response)) {
              cache.put(event.request, response.clone());
            }
            return response;
          })
          .catch(() => null);

        // If we have a cached version, return it immediately (stale-while-revalidate)
        // For hashed assets (_app/*) this is always fresh since hash changes on deploy
        if (cached) return cached;

        // No cache — wait for network
        const networkResponse = await networkFetch;
        if (networkResponse) return networkResponse;

        return new Response('Asset not available offline', { status: 503 });
      })()
    );
    return;
  }

  // ── Default: Network-first with cache fallback ───────────
  event.respondWith(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const response = await fetch(event.request);
        if (isCacheable(event.request, response)) {
          cache.put(event.request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});
