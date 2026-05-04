import { writable } from 'svelte/store';

function getInitialDarkMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = localStorage.getItem('darkMode');
    if (saved !== null) return saved === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function getInitialFontSize(): number {
  if (typeof window === 'undefined') return 16;
  try {
    const saved = localStorage.getItem('fontSize');
    if (saved !== null) {
      const val = parseInt(saved, 10);
      if ([14, 16, 18].includes(val)) return val;
    }
  } catch {}
  return 16;
}

export const FONT_SIZES = [14, 16, 18] as const;

export function cycleFontSize(current: number): number {
  const idx = FONT_SIZES.indexOf(current as typeof FONT_SIZES[number]);
  return FONT_SIZES[(idx + 1) % FONT_SIZES.length];
}

export const prefs = writable({
  darkMode: getInitialDarkMode(),
  fontSize: getInitialFontSize(),
  apiKey: '',
  notificationsEnabled: false,
});
