import { browser } from '$app/environment';

export const ADMIN_KEY_STORAGE = 'newsdigest_admin_key';

export function getStoredAdminKey(): string {
  if (!browser) return '';
  return localStorage.getItem(ADMIN_KEY_STORAGE)?.trim() ?? '';
}

export function saveAdminKey(key: string): string {
  const normalized = key.trim();
  if (browser) {
    if (normalized) {
      localStorage.setItem(ADMIN_KEY_STORAGE, normalized);
    } else {
      localStorage.removeItem(ADMIN_KEY_STORAGE);
    }
  }
  return normalized;
}

export function clearAdminKeyStorage() {
  if (browser) {
    localStorage.removeItem(ADMIN_KEY_STORAGE);
  }
}

export function adminHeaders(adminKey: string, includeJson = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) headers['Content-Type'] = 'application/json';
  if (adminKey.trim()) headers['X-Admin-Key'] = adminKey.trim();
  return headers;
}
