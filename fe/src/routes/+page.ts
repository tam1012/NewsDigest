import { api } from '$lib/api';
import type { Article } from '$lib/types';

export async function load({ fetch }) {
  try {
    const res = await fetch(api('/api/articles?limit=200&sort=date'));
    const data = await res.json();
    return { articles: (data.articles ?? []) as Article[], error: false };
  } catch (e) {
    console.error('Failed to fetch articles', e);
    return { articles: [] as Article[], error: true };
  }
}
