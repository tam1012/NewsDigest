import { Hono } from 'hono';
import { Env, ContentScrapeMessage } from '../../types';
import { SourceRepo, ArticleRepo } from '../../db';
import { requireAdmin, normalizeDate, resolveSource, ALLOWED_SOURCE_TYPES } from '../utils';
import { stripHtmlToText } from '../../scraper/utils';

const sources = new Hono<{ Bindings: Env }>();

// ── GET /api/sources ──────────────────────────────────────

sources.get('/', async (c) => {
    const results = await SourceRepo.findAllWithStats(c.env.DB);
    return c.json({ sources: results });
});

// ── POST /api/sources/resolve ─────────────────────────────

sources.post('/resolve', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const { url } = await c.req.json();
    if (!url || typeof url !== 'string') return c.json({ error: 'url is required' }, 400);

    try {
      const resolved = await resolveSource(url);
      return c.json({ ok: true, ...resolved });
    } catch (e: any) {
      return c.json({ error: e?.message || 'Failed to resolve source URL' }, 400);
    }
});

// ── POST /api/sources ─────────────────────────────────────

sources.post('/', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const { url, name, channel_id } = await c.req.json();
    if (!url || typeof url !== 'string') return c.json({ error: 'url is required' }, 400);

    let resolved;
    try {
      resolved = await resolveSource(url);
    } catch (e: any) {
      return c.json({ error: e?.message || 'Failed to resolve source URL' }, 400);
    }

    const id = crypto.randomUUID();
    await SourceRepo.insert(c.env.DB, {
      id,
      url: resolved.resolved_url,
      name: name || 'Custom Source',
      type: resolved.detected_type,
      channel_id: channel_id || null,
      enabled: 1,
    });

    return c.json({
      ok: true,
      source: {
        id,
        url: resolved.resolved_url,
        name: name || 'Custom Source',
        type: resolved.detected_type,
        channel_id: channel_id || null,
        enabled: 1
      },
      resolved_url: resolved.resolved_url,
      detected_type: resolved.detected_type,
      detection_method: resolved.detection_method,
    });
});

// ── PATCH /api/sources/:id ────────────────────────────────

sources.patch('/:id', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const id = c.req.param('id');
    const body = await c.req.json();
    const fields: Parameters<typeof SourceRepo.update>[2] = {};

    if (body.enabled !== undefined) { fields.enabled = body.enabled ? 1 : 0; }
    if (body.name !== undefined) { fields.name = body.name; }
    if (body.channel_id !== undefined) { fields.channel_id = body.channel_id; }
    if (body.url !== undefined) {
      if (typeof body.url !== 'string' || !body.url.trim()) return c.json({ error: 'Invalid url' }, 400);
      try {
        fields.url = new URL(body.url.trim()).toString();
      } catch {
        return c.json({ error: 'Invalid url' }, 400);
      }
    }
    if (body.type !== undefined) {
      if (!ALLOWED_SOURCE_TYPES.includes(body.type)) return c.json({ error: 'Invalid type' }, 400);
      fields.type = body.type;
    }

    if (Object.keys(fields).length === 0) return c.json({ error: 'No fields to update' }, 400);

    await SourceRepo.update(c.env.DB, id, fields);
    return c.json({ ok: true });
});

// ── DELETE /api/sources/:id ───────────────────────────────

sources.delete('/:id', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const id = c.req.param('id');
    await SourceRepo.deleteWithArticles(c.env.DB, id);
    return c.json({ ok: true });
});

// ── POST /api/sources/:id/fetch ───────────────────────────

sources.post('/:id/fetch', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const sourceId = c.req.param('id');
    const source = await SourceRepo.findById(c.env.DB, sourceId);
    if (!source) return c.json({ error: 'Not found' }, 404);

    const { fetchSource } = await import('../../scraper');
    try {
        const articles = await fetchSource(source, c.env);
        let insertedCount = 0;
        const newArticles: ContentScrapeMessage[] = [];

        for (const art of articles) {
            const idValue = crypto.randomUUID();
            const changes = await ArticleRepo.insertOrIgnore(c.env.DB, {
                id: idValue,
                source_id: source.id,
                url: art.url,
                title: art.title,
                description: art.description || '',
                published_at: normalizeDate(art.published_at),
            });
            if (changes > 0) {
                insertedCount++;
                newArticles.push({ articleId: idValue, url: art.url, title: art.title });

                // Pre-save content from RSS content:encoded (mirrors cron logic)
                if (art.contentEncoded) {
                    const plainText = stripHtmlToText(art.contentEncoded);
                    if (plainText.length >= 500) {
                        await ArticleRepo.updateContent(c.env.DB, idValue, plainText);
                        console.log(`📦 RSS content:encoded saved for "${art.title}" (${plainText.length} chars)`);
                    }
                }
            }
        }

        // ── Enqueue new articles for content scraping + AI summarization ──
        let enqueuedCount = 0;
        if (newArticles.length > 0) {
          const normalArticles = newArticles.filter(a => !a.url.includes('reddit.com'));
          const redditArticles = newArticles.filter(a => a.url.includes('reddit.com'));

          if (normalArticles.length > 0) {
            await c.env.CONTENT_QUEUE.sendBatch(
              normalArticles.map(a => ({ body: a }))
            );
            enqueuedCount += normalArticles.length;
          }

          // Stagger Reddit articles with 15s delay to avoid rate limits
          if (redditArticles.length > 0) {
            await c.env.CONTENT_QUEUE.sendBatch(
              redditArticles.map((a, j) => ({
                body: a,
                delaySeconds: j * 15,
              }))
            );
            enqueuedCount += redditArticles.length;
          }

          console.log(`📤 Enqueued ${enqueuedCount} articles for scraping from manual fetch of "${source.name}"`);
        }

        const lastFetchedAt = await SourceRepo.updateLastFetched(c.env.DB, source.id);

        return c.json({ ok: true, fetched: articles.length, inserted: insertedCount, enqueued: enqueuedCount, last_fetched_at: lastFetchedAt });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default sources;
