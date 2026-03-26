import { api } from '$lib/api';
import type { Source } from '$lib/types';

export const prerender = true;
export const ssr = false;

export async function load({ fetch }) {
  try {
    const res = await fetch(api('/api/sources'));
    const data = await res.json();
    return { sources: (data.sources ?? []) as Source[] };
  } catch (e) {
    console.error('Failed to fetch sources', e);
    return { sources: [] as Source[] };
  }
}
