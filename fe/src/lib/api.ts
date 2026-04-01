/**
 * API base URL — points to the deployed Cloudflare Worker.
 * Set via VITE_API_URL env var (auto-injected by deploy script).
 * Falls back to the production Worker URL.
 */
const FALLBACK_API_URL = 'https://newsdigest.trongnguyenchromeos.workers.dev';
export const API_BASE: string = import.meta.env.VITE_API_URL || FALLBACK_API_URL;

if (API_BASE === FALLBACK_API_URL && typeof window !== 'undefined') {
  console.warn('[NewsDigest] VITE_API_URL not set, using fallback:', FALLBACK_API_URL);
}

export function api(path: string): string {
  return `${API_BASE}${path}`;
}
