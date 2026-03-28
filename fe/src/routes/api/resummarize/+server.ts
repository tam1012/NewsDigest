import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ platform }) => {
  // Cloudflare Pages env via platform.env
  const env = (platform as any)?.env ?? {};
  const apiUrl = env.API_URL || 'https://newsdigest.trongnguyenchromeos.workers.dev';
  const adminKey = env.ADMIN_API_KEY || '';

  try {
    const res = await fetch(`${apiUrl}/api/articles/resummarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(adminKey ? { 'X-Admin-Key': adminKey } : {}),
      },
      body: JSON.stringify({ limit: 20, delayMs: 3000 }),
    });

    const data = await res.json();
    return json(data, { status: res.status });
  } catch (err: any) {
    console.error('Resummarize proxy error:', err.message);
    return json({ ok: false, error: err.message }, { status: 500 });
  }
};
