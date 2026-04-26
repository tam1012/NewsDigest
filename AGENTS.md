# AGENTS.md — NewsDigest

## Project layout

```
worker/   → Cloudflare Worker (Hono API + cron + queue consumer)
fe/       → SvelteKit frontend on Cloudflare Pages (adapter-cloudflare)
scripts/  → Node .mjs helpers (cf:init, deploy, fix-known-sources)
schema.sql → D1 migration (run by cf:init)
```

- Root `package.json` and `tsconfig.json` are for the **Worker only**.
- Frontend has its own `fe/package.json`, `fe/tsconfig.json`, `fe/svelte.config.js`.
- Both packages must have dependencies installed: `npm install` (root) and `npm install` (in `fe/`).
- `wrangler.toml` is managed by `npm run cf:init` — it rewrites the file. Do not hand-edit D1/KV/queue bindings; re-run `cf:init` instead.

## Commands

```bash
npm run dev          # Worker on localhost:8787
npm run dev:fe       # Frontend on localhost:5173
npm run cf:init      # Idempotent: creates D1, KV, Queues, Pages project, secrets, migration
npm run deploy       # Deploys Worker → builds FE with VITE_API_URL → deploys Pages
npm run fix:sources  # Fix known source URLs in local D1
npm run fix:sources:remote  # Same against remote D1
```

- No test framework is configured. There is no `npm test`.
- Frontend type-check: `cd fe && npm run check` (svelte-kit sync + svelte-check).
- No linter is configured in either package.

## Architecture quirks

### Cron dispatch (`worker/index.ts:13-33`)
- `0 */3 * * *` → scrape all sources **except** `github-trending`, then generate digest.
- `0 1 * * *`   → scrape **only** `github-trending` sources, then run 7-day content cleanup.
- `*/30 * * * *` → retry failed articles only (no new scrape).

### GitHub Trending is processed inline (no queue)
GitHub Trending summaries happen inside the cron handler, not via the queue consumer, because Free-plan queue consumers have a ~10ms CPU limit that kills lengthy README fetches. Cron workers have a 15-minute wall-clock limit.

### Reddit rate-limit staggering
- Reddit sources are fetched **sequentially** with 15s gaps during cron (`worker/cron/index.ts:239-258`).
- Reddit articles enqueued via `sendBatch` use per-message `delaySeconds` (15s × position).
- Reddit rate-limit errors get 120s retry delay; non-Reddit get 30s.

### RSS content:encoded pre-save
If an RSS feed provides `content:encoded` (e.g. WordPress), the cron handler strips HTML and saves it to `articles.content` immediately. The queue consumer sees existing content and skips scraping, going straight to AI summarization.

### AI backend modes (`worker/ai/client.ts`)
- **Direct Gemini**: set `GEMINI_API_KEY` secret → calls `generativelanguage.googleapis.com`.
- **Cloudflare AI Gateway**: set `AI_GATEWAY_URL` + `AI_GATEWAY_TOKEN` secrets.
- If both are set, `GEMINI_API_KEY` wins.

### Error & retry strategy (`worker/errors.ts`)
Queue consumer failures are classified as permanent (ack) or transient (retry):
- `ProhibitedContentError`, `ContentUnavailableError`, `ConfigError` → ack (no retry).
- `RateLimitError`, `NetworkError`, `ParseError`, unknown → retry with optional delay.
- Reddit URLs get longer delays than other sources.

### Scraper profile system
AI-learned CSS selector profiles for HTML content extraction are stored in KV (`SCRAPER_CONFIG`) and D1 (`scraper_configs`). Profiles are learned per-domain. Two modes: `content` (article body selectors) and `listing` (link/article list selectors).

### Admin auth
Write endpoints (add/delete sources, resummarize) check `X-Admin-Key` header against `ADMIN_API_KEY` secret. If no key is configured, auth is skipped (insecure).

## Key files to know

| File | Purpose |
|---|---|
| `worker/index.ts` | Worker entry: dispatch fetch/cron/queue |
| `worker/api/index.ts` | Hono router: `/api/articles`, `/api/digest`, `/api/sources`, `/api/scraper-configs` |
| `worker/cron/index.ts` | Main cron handler: fetch sources, insert articles, enqueue |
| `worker/cron/digest.ts` | Generate daily digest from summarized articles |
| `worker/queue/content-scraper.ts` | Queue consumer: fetch article content → AI summarize |
| `worker/queue/fetchers/index.ts` | Content fetcher registry (youtube → reddit → github → generic) |
| `worker/scraper/fetchers/` | Source-type scrapers (rss, html, reddit, youtube, voz, github-trending) |
| `worker/db/` | D1 query helpers (articles, sources, digests, scraper-configs) |
| `fe/src/lib/api.ts` | API base URL resolution (VITE_API_URL or localhost fallback) |
| `fe/src/lib/admin.ts` | Admin key stored in localStorage |
| `fe/src/service-worker.ts` | PWA service worker: cache-first for assets, network-first for API |
| `scripts/cf-init.mjs` | One-shot Cloudflare resource provisioning |
| `scripts/deploy.mjs` | Worker deploy → FE build → Pages deploy |

## Conventions

- All URLs passed to content fetchers go through `assertSafePublicHttpUrl()` (`worker/utils/url-safety.ts`) which blocks private/internal IPs as an SSRF guard.
- Article dedup is `UNIQUE(source_id, url)` in D1 — `INSERT OR IGNORE` for non-Reddit, explicit check-before-insert for Reddit/GitHub.
- ISO 8601 UTC for all timestamps. `published_at` falls back to `new Date().toISOString()` if parsing fails.
- FE uses Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`). No Svelte 4 stores.
- Tailwind v4 with `@tailwindcss/vite` plugin (no `tailwind.config.js`).
- `.env` files are gitignored except `.env.example` and `.env.example.gateway`.
