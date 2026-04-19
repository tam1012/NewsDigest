import { Hono } from 'hono';
import { Env } from '../../types';
import { requireAdmin, normalizeDate, resolveSource, ALLOWED_SOURCE_TYPES } from '../utils';

const sources = new Hono<{ Bindings: Env }>();

// ── GET /api/sources ──────────────────────────────────────

sources.get('/', async (c) => {
    const { results } = await c.env.DB.prepare(`
      SELECT
        s.id,
        s.url,
        s.name,
        s.type,
        s.enabled,
        s.channel_id,
        s.last_fetched_at,
        s.created_at,
        COUNT(a.id) AS article_count,
        COALESCE(SUM(CASE WHEN a.summary IS NOT NULL THEN 1 ELSE 0 END), 0) AS summarized_count
      FROM sources s
      LEFT JOIN articles a ON a.source_id = s.id
      GROUP BY s.id
      ORDER BY s.name ASC
    `).all();
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
    await c.env.DB.prepare(
        'INSERT INTO sources (id, url, name, type, channel_id, enabled) VALUES (?, ?, ?, ?, ?, 1)'
    ).bind(
      id,
      resolved.resolved_url,
      name || 'Custom Source',
      resolved.detected_type,
      channel_id || null,
    ).run();

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
    const sets: string[] = [];
    const binds: any[] = [];

    if (body.enabled !== undefined) { sets.push('enabled = ?'); binds.push(body.enabled ? 1 : 0); }
    if (body.name !== undefined) { sets.push('name = ?'); binds.push(body.name); }
    if (body.channel_id !== undefined) { sets.push('channel_id = ?'); binds.push(body.channel_id); }
    if (body.url !== undefined) {
      if (typeof body.url !== 'string' || !body.url.trim()) return c.json({ error: 'Invalid url' }, 400);
      try {
        const normalizedUrl = new URL(body.url.trim()).toString();
        sets.push('url = ?');
        binds.push(normalizedUrl);
      } catch {
        return c.json({ error: 'Invalid url' }, 400);
      }
    }
    if (body.type !== undefined) {
      if (!ALLOWED_SOURCE_TYPES.includes(body.type)) return c.json({ error: 'Invalid type' }, 400);
      sets.push('type = ?');
      binds.push(body.type);
    }

    if (sets.length === 0) return c.json({ error: 'No fields to update' }, 400);

    binds.push(id);
    await c.env.DB.prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
    return c.json({ ok: true });
});

// ── DELETE /api/sources/:id ───────────────────────────────

sources.delete('/:id', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const id = c.req.param('id');
    // Xoá articles liên quan trước để tránh lỗi foreign key
    await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM articles WHERE source_id = ?').bind(id),
        c.env.DB.prepare('DELETE FROM sources WHERE id = ?').bind(id),
    ]);
    return c.json({ ok: true });
});

// ── POST /api/sources/:id/fetch ───────────────────────────

sources.post('/:id/fetch', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const sourceId = c.req.param('id');
    const { results } = await c.env.DB.prepare('SELECT * FROM sources WHERE id = ?').bind(sourceId).all();
    if (!results || results.length === 0) return c.json({ error: 'Not found' }, 404);

    const source = results[0] as any;
    const { fetchSource } = await import('../../cron/scraper');
    try {
        const articles = await fetchSource(source, c.env);
        let insertedCount = 0;
        for (const art of articles) {
            const aId = crypto.randomUUID();
            const result = await c.env.DB.prepare(
                `INSERT OR IGNORE INTO articles (id, source_id, url, title, description, published_at)
                 VALUES (?, ?, ?, ?, ?, ?)`
            ).bind(aId, source.id, art.url, art.title, art.description || '', normalizeDate(art.published_at)).run();

            if (result.meta && result.meta.changes > 0) insertedCount++;
        }
        const lastFetchedAt = new Date().toISOString();
        await c.env.DB.prepare(
          'UPDATE sources SET last_fetched_at = ? WHERE id = ?'
        ).bind(lastFetchedAt, source.id).run();

        return c.json({ ok: true, fetched: articles.length, inserted: insertedCount, last_fetched_at: lastFetchedAt });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

export default sources;
