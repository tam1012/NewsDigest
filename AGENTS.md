# AGENTS.md — NewsDigest

Guidelines for AI coding agents working with this codebase.

---

## Project Overview

NewsDigest is a personal PWA news aggregator running entirely on the Cloudflare stack:

- **Worker** (`/worker`) — Cloudflare Worker built with Hono + TypeScript: cron scraper, queue consumer, REST API
- **Frontend** (`/fe`) — SvelteKit + Tailwind CSS v4 + shadcn-svelte, deployed to Cloudflare Pages
- **AI** — Gemini (direct API or via Cloudflare AI Gateway) for article summarization + daily digest generation

Main flow: Cron → scrape sources → insert articles into D1 → enqueue to Queue → queue consumer fetches content + calls AI → FE reads via REST API.

---

## Directory Structure

```
/
├── worker/                     # Cloudflare Worker (backend)
│   ├── index.ts                # Entry point: fetch / scheduled / queue handlers
│   ├── types.ts                # Env interface + all shared types (incl. PROMPT_* env vars)
│   ├── errors.ts               # Typed error classes (NetworkError, RateLimitError, etc.) + retryStrategy()
│   ├── api/
│   │   ├── index.ts            # Hono app, route mounting
│   │   ├── utils.ts            # requireAdmin(), normalizeDate(), resolveSource()
│   │   └── routes/
│   │       ├── articles.ts     # GET /api/articles, POST /enrich, /enqueue-scrape, /resummarize, /summarize
│   │       ├── sources.ts      # CRUD sources + POST /resolve, POST /:id/fetch
│   │       ├── digest.ts       # GET /api/digest, POST /generate
│   │       └── scraper.ts      # Admin: scraper config management + POST /scraper-profile/test
│   ├── cron/
│   │   ├── index.ts            # scheduled() — main scrape loop (every 3h)
│   │   ├── scraper.ts          # ⚠️ Backward-compat shim only — re-exports from worker/scraper/
│   │   ├── digest.ts           # scheduledDigest() — create/update daily digest
│   │   ├── retry-failed.ts     # retryFailedArticles() — runs every 30 minutes
│   │   ├── site-profiles.ts    # Static hardcoded scraper profiles per domain + resolveStaticProfile()
│   │   └── cleanup.ts          # cleanOldContent() — purge content older than 7 days
│   ├── db/
│   │   ├── index.ts            # Re-exports all repos (ArticleRepo, SourceRepo, DigestRepo, ScraperConfigRepo)
│   │   ├── articles.ts         # All D1 queries for the articles table
│   │   ├── sources.ts          # All D1 queries for the sources table
│   │   ├── digests.ts          # All D1 queries for the digests table
│   │   └── scraper-configs.ts  # All D1 queries for the scraper_configs table
│   ├── queue/
│   │   ├── content-scraper.ts  # handleContentQueue() — orchestrates fetch + AI summarize
│   │   └── fetchers/
│   │       ├── index.ts        # ContentFetcher interface + resolveFetcher() registry
│   │       ├── youtube.ts      # RapidAPI yt-api transcript fetcher
│   │       ├── reddit.ts       # Reddit JSON API fetcher (post + top comments)
│   │       ├── github.ts       # GitHub API README fetcher
│   │       └── generic.ts      # Fallback: delegates to extractArticleContent()
│   ├── scraper/
│   │   ├── index.ts            # Public API: re-exports fetchSource, extractArticleContent, etc.
│   │   ├── source.ts           # fetchSource() — dispatches to per-type fetcher
│   │   ├── extract.ts          # extractArticleContent() + extractFromHtmlWithProfile()
│   │   ├── utils.ts            # normalizeDate, parseRssOrAtom, fetchFeedBuffer, sanitizeHtmlForAi, etc.
│   │   ├── fetchers/
│   │   │   ├── rss.ts          # fetchRSS() — RSS/Atom/RDF/JSON Feed with charset detection
│   │   │   ├── youtube.ts      # fetchYouTube() — RSS first, API v3 fallback
│   │   │   ├── reddit.ts       # fetchReddit() — /hot.json listing
│   │   │   ├── github-trending.ts # fetchGitHubTrending() — HTMLRewriter scrape
│   │   │   ├── voz.ts          # fetchVoz() — HTMLRewriter scrape
│   │   │   └── html.ts         # fetchUnknown() — AI listing profiles + fallback heuristics
│   │   └── profiles/
│   │       ├── content.ts      # loadStoredProfile, saveProfile, normalizeProfile, shouldAcceptCandidate
│   │       └── listing.ts      # loadStoredListingProfile, extractListingWithSelectorSet, buildListingArticles
│   └── ai/
│       ├── client.ts           # buildGeminiRequest(env, model) — auto-detects Direct vs Gateway mode
│       ├── summarizer.ts       # summarizeArticle() + generateDigest() + Gemini call logic + fallback
│       ├── scraper-profile.ts  # generateScraperProfile() + generateListingProfile() + callGemini()
│       └── prompt-config.ts    # buildPromptConfig(env) — reads PROMPT_* env vars with defaults
├── fe/                         # SvelteKit frontend (PWA)
│   └── src/
│       ├── lib/
│       │   ├── api.ts          # API_BASE + api() helper
│       │   ├── types.ts        # Article, Source, Digest interfaces
│       │   ├── stores/         # Svelte stores (articles, sources, cache, prefs)
│       │   └── components/     # UI components (app/ and ui/)
│       └── routes/
│           ├── +page.svelte    # Main article feed
│           └── sources/        # Source management page
├── scripts/
│   ├── cf-init.mjs             # One-time Cloudflare resource setup (D1, KV, Queue, Pages)
│   ├── deploy.mjs              # Full deploy: worker + fe
│   ├── deploy-fe.mjs           # Frontend-only deploy
│   └── fix-known-sources.mjs   # Seed/fix known sources
├── schema.sql                  # D1 schema (sources, articles, digests, scraper_configs)
├── .env.example.gemini         # Env template — Option A: Direct Gemini API key (simpler)
└── .env.example.gateway        # Env template — Option B: Cloudflare AI Gateway (advanced)
```

---

## Database Schema (D1)

Four main tables — see `schema.sql` for full definitions:

| Table | Description |
|---|---|
| `sources` | User-added news sources. Types: `rss`, `html`, `reddit`, `youtube`, `voz`, `github-trending` |
| `articles` | Collected articles. `summary`, `hot_score`, and `tags` are populated later by AI. `content` is set to NULL after AI processing |
| `digests` | Daily AI-generated digest, one row per day (`digest_date` UNIQUE), upserted every 3h |
| `scraper_configs` | AI-learned CSS selector profiles (per domain, mode `html` or `listing`) |

**Important notes on `articles`:**
- `content` is temporary — it is SET NULL after AI summarization completes, to save D1 storage
- `summary IS NULL` = article not yet processed by AI (used as the retry condition)
- `summary = '[blocked]'` = blocked by Gemini safety filters, do not retry

---

## Cron Schedule

| Cron | Handler | What it does |
|---|---|---|
| `0 */3 * * *` | `scheduled()` → `scheduledDigest()` | Scrape all sources (except github-trending) → generate daily digest |
| `0 1 * * *` | `scheduled()` → `cleanOldContent()` | Scrape github-trending only + purge content older than 7 days |
| `*/30 * * * *` | `retryFailedArticles()` | Re-enqueue failed articles (no summary) within the last 3 days |

---

## Source Types & Fetch Strategy

Each source type has its own fetcher in `worker/scraper/fetchers/`:

| Type | Fetcher | Notes |
|---|---|---|
| `rss` | `fetchRSS()` | Supports RSS, Atom, RDF, JSON Feed. Automatic charset detection |
| `youtube` | `fetchYouTube()` | RSS feed first → fallback to YouTube Data API v3. Channel ID cached in `sources.channel_id` |
| `reddit` | `fetchReddit()` | Reddit JSON API (`/hot.json`). Sequential with 15s stagger to avoid rate limits |
| `github-trending` | `fetchGitHubTrending()` | HTMLRewriter scrape of `github.com/trending` |
| `voz` | `fetchVoz()` | HTMLRewriter scrape of `voz.vn` |
| `html` | `fetchUnknown()` | AI-learned listing profiles (CSS selectors stored in D1) |

Entry point is `fetchSource()` in `worker/scraper/source.ts`, dispatches to the above.

---

## Queue Flow (Content Scraping)

```
Cron inserts article → CONTENT_QUEUE.sendBatch()
    ↓
handleContentQueue() [worker/queue/content-scraper.ts]
    ↓
resolveFetcher(url) [worker/queue/fetchers/index.ts]
    ├── youtubeFetcher  → RapidAPI yt-api /subtitles → parse XML transcript
    ├── redditFetcher   → reddit.com/.json (post + top comments)
    ├── githubFetcher   → GitHub API /readme → raw download
    └── genericFetcher  → extractArticleContent() (HTMLRewriter + AI profiles)
    ↓
summarizeArticle() [worker/ai/summarizer.ts]
    ├── JSON mode (Gemini, retry 3x, alternating models)
    └── Fallback: 4-step plain text (description_vn → summary → score → tags)
    ↓
UPDATE articles SET summary=?, hot_score=?, tags=?, content=NULL
```

**Reddit articles** are enqueued with per-message `delaySeconds` stagger (15s per article) to avoid 429s. The `redditFetcher` itself does **not** add delays — staggering is handled entirely at enqueue time.

---

## AI / Gemini Integration

Files: `worker/ai/client.ts`, `worker/ai/summarizer.ts`, `worker/ai/scraper-profile.ts`, `worker/ai/prompt-config.ts`

- Model pool: `gemma-4-31b-it` and `gemma-4-26b-a4b-it` — random pick + automatic failover on 429
- **Dual backend** — `buildGeminiRequest(env, model)` in `worker/ai/client.ts` auto-detects mode:
  - **Mode A (Direct):** `GEMINI_API_KEY` set → calls `https://generativelanguage.googleapis.com/v1beta/...?key=...` directly
  - **Mode B (Gateway):** `AI_GATEWAY_URL` + `AI_GATEWAY_TOKEN` set → routes through Cloudflare AI Gateway
  - `GEMINI_API_KEY` takes priority if both are set; throws a clear error if neither is configured
- JSON mode (`responseMimeType: 'application/json'`) — `extractJson()` handles repair/fallback parsing
- `ProhibitedContentError` = blocked by safety filters, do NOT retry, marks `summary='[blocked]'`
- Prompts are configurable via `PROMPT_*` env vars — see `worker/ai/prompt-config.ts` and Environment Variables section

**Article output schema:**
```ts
{ description_vn: string, summary: string (Markdown), hot_score: 1-10, tags: string[] }
```

**Digest output schema:**
```ts
{ digest_text: string } // Markdown with inline <id:uuid> references
```

---

## REST API Endpoints

Base URL: Worker URL (local: `http://localhost:8787`)

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/articles` | — | List articles with pagination and filters (tag, source_id, min_hot, from/to, ids, sort, compact) |
| GET | `/api/articles/:id` | — | Single article detail |
| POST | `/api/articles/enrich` | — | Fetch raw content for articles that lack it (batched, max 5 parallel) |
| POST | `/api/articles/enqueue-scrape` | — | Manually enqueue articles to the Queue for content scraping |
| POST | `/api/articles/resummarize` | Admin | Re-run AI on articles that have content but no summary |
| POST | `/api/articles/summarize` | — | Dify integration: batch-update summary fields |
| GET | `/api/sources` | — | List all sources with article/summarized counts |
| POST | `/api/sources/resolve` | Admin | Resolve + detect type for a URL (without saving) |
| POST | `/api/sources` | Admin | Add a new source (auto-resolves URL) |
| PATCH | `/api/sources/:id` | Admin | Update source fields (enabled, name, url, type, channel_id) |
| DELETE | `/api/sources/:id` | Admin | Delete a source and all its articles |
| POST | `/api/sources/:id/fetch` | Admin | Manually trigger a fetch for one source |
| GET | `/api/digest` | — | Get digest (defaults to today VN time, accepts ?date=YYYY-MM-DD) |
| POST | `/api/digest` | — | Manual digest submission |
| POST | `/api/digest/generate` | — | Manually trigger digest generation |
| GET | `/api/scraper-configs` | — | List all AI-learned scraper profiles |
| DELETE | `/api/scraper-configs/:id` | Admin | Delete a scraper profile by ID |
| POST | `/api/scraper-profile/test` | Admin | Test/learn a scraper profile for a URL (mode: article or listing) |

Admin auth: `X-Admin-Key: <ADMIN_API_KEY>` header. Auth is skipped if `ADMIN_API_KEY` is not set in env.

---

## Environment Variables

See `.env.example.gemini` (Option A) or `.env.example.gateway` (Option B) for the full list. Key variables:

**AI Backend — set ONE of the following two options:**

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Option A | Direct Gemini API key — get free at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `AI_GATEWAY_URL` | ✅ Option B | `https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/google-ai-studio` |
| `AI_GATEWAY_TOKEN` | ✅ Option B | Auth token from Cloudflare AI Gateway |

**Other variables:**

| Variable | Required | Description |
|---|---|---|
| `RAPIDAPI_KEY` | ✅ | YouTube transcript fetching via yt-api.p.rapidapi.com |
| `YOUTUBE_API_KEY` | ☑️ | Fallback when YouTube RSS feeds are unavailable |
| `ADMIN_API_KEY` | ☑️ | Protects write endpoints |
| `PROMPT_OUTPUT_LANGUAGE` | ☑️ | Output language for AI summaries (default: `Vietnamese`) |
| `PROMPT_OUTPUT_LOCALE` | ☑️ | Short locale code used in prompt phrasing (default: `vi`) |
| `PROMPT_TOPIC_PRIORITIES` | ☑️ | Comma-separated priority topics for hot_score boosting |
| `PROMPT_ALLOWED_TAGS` | ☑️ | Comma-separated tag whitelist for AI tagging |
| `PROMPT_DIGEST_HEADINGS` | ☑️ | Comma-separated suggested ## headings in digest (soft suggestions) |
| `PROMPT_CUSTOM_CONTEXT` | ☑️ | Free-form extra instruction appended to system prompt (plain text only) |

All `PROMPT_*` vars are optional — defaults reproduce the current Vietnamese/tech behavior. Cloudflare bindings defined in the `Env` interface (`worker/types.ts`): `DB` (D1), `SCRAPER_CONFIG` (KV), `CONTENT_QUEUE` (Queue).

---

## Local Development

```bash
# Install dependencies
npm install && cd fe && npm install && cd ..

# Copy env files
# Copy env files (choose one)
cp .env.example.gemini .env     # Option A: Direct Gemini API key (simpler)
# cp .env.example.gateway .env  # Option B: Cloudflare AI Gateway
cp fe/.env.example fe/.env.local  # set VITE_API_URL=http://localhost:8787

# Terminal 1: Worker (localhost:8787)
npm run dev

# Terminal 2: Frontend (localhost:5173)
npm run dev:fe
```

---

## Deploy

```bash
# First-time setup (creates D1, KV, Queue, Pages project)
npm run cf:init

# Full deploy (worker + frontend)
npm run deploy

# Frontend only
npm run deploy:fe

# Worker only
npm run deploy:worker
```

---

## Conventions & Important Gotchas

**TypeScript / Worker:**
- All types are defined in `worker/types.ts` — do not create duplicate type definitions elsewhere
- All D1 queries go through `worker/db/` repos — no raw SQL in business logic
- Typed errors live in `worker/errors.ts` — use `NetworkError`, `RateLimitError`, `ContentUnavailableError`, `ConfigError`, `ProhibitedContentError`; `retryStrategy()` decides queue ack vs retry
- Env bindings must match `wrangler.toml` (D1 `DB`, KV `SCRAPER_CONFIG`, Queue `CONTENT_QUEUE`)
- Workers free plan has a 6 subrequest limit — use `sendBatch()` instead of looping `send()`
- Reddit fetching is always sequential, never parallel (rate limits from Cloudflare datacenter IPs)
- `content` column is temporary storage — it is always set NULL after AI processing, do not use it as a long-term cache
- `worker/cron/scraper.ts` is a backward-compat shim only — import from `worker/scraper/` for new code

**AI / Scraper:**
- `scraper_configs` caches AI-learned CSS selectors — invalidate by deleting the row via the admin API
- YouTube `channel_id` is cached in `sources.channel_id` after the first successful resolve
- Listing profiles (`mode='listing'`) and content profiles (`mode='html'`) are two distinct profile types
- `PROMPT_CUSTOM_CONTEXT` must be plain text only — no XML tags or markdown that could break the system prompt structure

**Frontend (SvelteKit):**
- `API_BASE` is injected at build time via `VITE_API_URL` — never hardcode the Worker URL
- TypeScript interfaces in `fe/src/lib/types.ts` must stay in sync with `worker/types.ts`
- Deployed to Cloudflare Pages using the static adapter — no SSR
- PWA service worker is at `fe/src/service-worker.ts`

**Gemini rate limits:**
- 2 models in the pool (RPM=15 each → effective RPM=30)
- On 429, auto-switches to the other model with exponential backoff
- Digest generation uses a 120s timeout (larger prompt due to batching 40+ articles)
