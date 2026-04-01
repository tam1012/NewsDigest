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
    // Step 1: Enqueue unsummarized articles for content scraping + AI summarize
    // The queue consumer handles both scrape and AI in one pipeline
    const enqueueRes = await fetch(`${apiUrl}/api/articles/enqueue-scrape`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 50 }),
    });
    const enqueueData = await enqueueRes.json() as Record<string, unknown>;

    // Step 2: Also retry AI for articles that already have content but AI failed
    const resummarizeRes = await fetch(`${apiUrl}/api/articles/resummarize`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ limit: 20, delayMs: 3000 }),
    });
    const resummarizeData = await resummarizeRes.json() as Record<string, unknown>;

    return json({
      ok: true,
      enqueued: enqueueData.enqueued ?? 0,
      summarized: resummarizeData.summarized ?? 0,
      failed: resummarizeData.failed ?? 0,
    });
  } catch (err: any) {
    console.error('Resummarize proxy error:', err.message);
    return json({ ok: false, error: err.message }, { status: 500 });
  }
};
