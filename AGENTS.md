# AGENTS.md — NewsDigest

## Repo shape

- `worker/` is the backend app (Cloudflare Worker + Hono API + cron + queue consumer). Root `package.json`/`tsconfig.json` apply to this only.
- `fe/` is a separate SvelteKit app (Cloudflare adapter) with its own `package.json` and TS config.
- Install deps in both places: `npm install` at repo root and `npm install` in `fe/`.
- `wrangler.toml` is generated/updated by `npm run cf:init` (`# managed-by-cf-init` marker). Do not hand-edit bindings; re-run init.

## Commands that matter

- Dev: `npm run dev` (Worker on `:8787`) and `npm run dev:fe` (FE on `:5173`).
- Provision/update Cloudflare resources: `npm run cf:init`.
- Deploy all: `npm run deploy` (worker deploy -> FE build with `VITE_API_URL` -> Pages deploy).
- Deploy only FE: `npm run deploy:fe` (requires `WORKER_PUBLIC_URL` in `.env`).
- Deploy only Worker: `npm run deploy:worker`.
- Patch known source URLs in D1: `npm run fix:sources` (local) or `npm run fix:sources:remote`.
- There is no test/lint script configured. Fastest checks are `npx tsc --noEmit` (worker) and `cd fe && npm run check` (Svelte typecheck).

## Verified deploy/env gotchas

- `cf:init` currently requires `AI_GATEWAY_URL` and `AI_GATEWAY_TOKEN` in `.env` and pushes those secrets.
- `buildGeminiRequest` supports either Direct Gemini (`GEMINI_API_KEY`) or AI Gateway, and if both exist, `GEMINI_API_KEY` wins.
- Practical implication: Direct-Gemini-only setup is supported by runtime code, but not fully by current `cf:init` requirements.
- `.env` is ignored by git; tracked examples are `.env.example` and `.env.example.gateway`.

## Runtime flow quirks

- Four cron paths are active (`worker/settings.ts` + `wrangler.toml`):
  - `0 */3 * * *`: scrape all non-`github-trending` sources, then generate digest.
  - `0 1 * * *`: scrape only `github-trending` sources.
  - `*/30 * * * *`: retry failed articles only.
  - `30 23 * * *`: retention cleanup only.
- `github-trending` is summarized inline during cron (not via queue) to avoid queue-consumer CPU limits.
- Reddit handling is intentionally throttled: sequential source fetch with 15s stagger; queue messages also delayed per item.
- For RSS items with `content:encoded`, HTML is stripped and saved before enqueue; queue worker then reuses saved content and skips scraping.

## Data and safety conventions

- URL safety is enforced before fetch (`assertSafePublicHttpUrl`), blocking private/internal targets (SSRF guard).
- Dedup key is DB-level `UNIQUE(source_id, url)`; non-Reddit usually `insertOrIgnore`, Reddit/GitHub paths do explicit reprocess checks.
- Timestamps are normalized to ISO UTC; invalid/missing `published_at` falls back to current time.
- Admin write protection is header `X-Admin-Key` vs `ADMIN_API_KEY`; if secret is unset, write auth is effectively disabled.
- FE codebase uses Svelte 5 runes and Tailwind v4 (`@tailwindcss/vite`), no `tailwind.config.js`.
