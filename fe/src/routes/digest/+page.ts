import { api } from '$lib/api';

export async function load({ fetch }) {
  try {
    const res = await fetch(api('/api/digest/latest'));
    const data = await res.json();
    if (data.error) {
      return { digest: null, topArticles: [], error: data.error as string };
    }
    return { digest: data.digest, topArticles: data.topArticles ?? [], error: '' };
  } catch (e) {
    console.error('Failed to fetch digest', e);
    return { digest: null, topArticles: [], error: 'Failed to load digest' };
  }
}
