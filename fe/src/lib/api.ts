/**
 * API base URL — points to the deployed Cloudflare Worker.
 * Set via VITE_API_URL env var (auto-injected by deploy script).
 */
export const API_BASE: string = import.meta.env.VITE_API_URL ?? '';

if (!API_BASE && typeof window !== 'undefined') {
  console.error('[NewsDigest] VITE_API_URL is not set. API calls will fail.');
}

export function api(path: string): string {
  return `${API_BASE}${path}`;
}
