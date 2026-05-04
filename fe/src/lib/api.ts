/**
 * API base URL — points to the deployed Cloudflare Worker.
 *
 * Production: VITE_API_URL is injected at build time by the deploy script
 *             (set as a Cloudflare Pages environment variable).
 * Local dev:  automatically falls back to http://localhost:8787 (wrangler dev).
 *             No .env.local needed.
 */
export const API_BASE: string =
  import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8787' : '');

export function api(path: string): string {
  return `${API_BASE}${path}`;
}
