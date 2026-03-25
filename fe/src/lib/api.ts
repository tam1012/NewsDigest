/**
 * API base URL resolution:
 * 1. VITE_API_URL env var (set in .env.local to point to Cloudflare when dev local)
 * 2. In prod → Cloudflare Worker URL
 * 3. In dev (with local Worker running) → empty string, Vite proxy handles /api
 */
const PROD_API = 'https://newsdigest.trongnguyenchromeos.workers.dev';

export const API_BASE: string =
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? '' : PROD_API);

export function api(path: string): string {
  return `${API_BASE}${path}`;
}
