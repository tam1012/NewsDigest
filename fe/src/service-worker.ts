/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

import { build, files, version } from '$service-worker';

// Cast self to the correct ServiceWorker global type
const sw = /** @type {ServiceWorkerGlobalScope} */ (globalThis as unknown as ServiceWorkerGlobalScope);

// ── Cache name — changes on every deploy ──────────────────────────────────────
// `version` is derived from kit.version (timestamp by default), so every new
// build produces a unique cache name and nukes the previous one automatically.
const CACHE = `newsdigest-${version}`;

// Pre-cache list: every hashed JS/CSS chunk + every file in /static
const ASSETS = [
	...build, // /_app/immutable/... (hashed chunks — unique per build)
	...files  // /manifest.json, /icon-*.png, /favicon.*, /robots.txt, etc.
];

// ── Install: eagerly cache the whole app shell ─────────────────────────────────
sw.addEventListener('install', (event) => {
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		// addAll is atomic — if any URL fails, the whole install fails cleanly.
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

// ── Activate: purge caches from previous deployments ──────────────────────────
sw.addEventListener('activate', (event) => {
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(deleteOldCaches());
});

// ── Fetch: serve cached assets immediately; network-first for everything else ──
sw.addEventListener('fetch', (event) => {
	// Ignore non-GET requests (POST, etc.)
	if (event.request.method !== 'GET') return;

	// Ignore non-http(s) requests (e.g. chrome-extension://)
	if (!event.request.url.startsWith('http')) return;

	async function respond(): Promise<Response> {
		const url = new URL(event.request.url);
		const cache = await caches.open(CACHE);

		// ── API calls: network-first, offline JSON fallback ────────────────────
		// The app reads IndexedDB when offline — the SW just needs to not crash.
		if (url.pathname.startsWith('/api/')) {
			try {
				const response = await fetch(event.request);
				if (response instanceof Response && response.ok) {
					return response;
				}
				throw new Error('bad response');
			} catch {
				return new Response(
					JSON.stringify({ offline: true, articles: [], total: 0, digest: null }),
					{ status: 200, headers: { 'Content-Type': 'application/json' } }
				);
			}
		}

		// ── Pre-cached assets (build + files): cache-first, always fresh ──────
		// Hashed assets are immutable — the hash changes on deploy, so the cache
		// name changes too and old entries are evicted in the activate step.
		if (ASSETS.includes(url.pathname)) {
			const cached = await cache.match(url.pathname);
			if (cached) return cached;
		}

		// ── Everything else (navigation, etc.): network-first, cache fallback ──
		try {
			const response = await fetch(event.request);

			// Protect against opaque / invalid responses before caching
			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			if (response.status === 200) {
				cache.put(event.request, response.clone());
			}

			return response;
		} catch (err) {
			const cached = await cache.match(event.request);
			if (cached) return cached;
			throw err;
		}
	}

	event.respondWith(respond());
});
