import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ platform }) => {
  // Cloudflare Pages env via platform.env
  const env = (platform as any)?.env ?? {};
  const apiUrl = env.API_URL || '';
  const adminKey = env.ADMIN_API_KEY || '';

  if (!apiUrl) {
    return json({ ok: false, error: 'API_URL not configured in Pages secrets' }, { status: 500 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(adminKey ? { 'X-Admin-Key': adminKey } : {}),
  };

  try {
    // Enqueue unsummarized articles into the Queue.
    // The queue consumer handles scrape + AI summarize asynchronously —
    // we no longer call Gemini here to avoid the 30s Pages Function timeout.
    const enqueueRes = await fetch(`${apiUrl}/api/articles/enqueue-scrape`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 50 }),
    });
    const enqueueData = await enqueueRes.json() as Record<string, unknown>;

    return json({
      ok: true,
      enqueued: enqueueData.enqueued ?? 0,
      enqueuedAt: Date.now(),
    });
  } catch (err: any) {
    console.error('Resummarize proxy error:', err.message);
    return json({ ok: false, error: err.message }, { status: 500 });
  }
};
