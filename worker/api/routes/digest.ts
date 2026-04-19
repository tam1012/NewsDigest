import { Hono } from 'hono';
import { Env } from '../../types';

const digest = new Hono<{ Bindings: Env }>();

// ── GET /api/digest ───────────────────────────────────────

/**
 * Trả về digest cho ngày cụ thể (default: hôm nay VN).
 * Query: ?date=YYYY-MM-DD
 */
digest.get('/', async (c) => {
    const dateParam = c.req.query('date');
    // Default to today VN
    const now = new Date();
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const dateStr = dateParam || vnNow.toISOString().slice(0, 10);

    const { results } = await c.env.DB.prepare(
        'SELECT * FROM digests WHERE digest_date = ?'
    ).bind(dateStr).all();

    if (!results || results.length === 0) {
        return c.json({ digest: null });
    }

    return c.json({ digest: results[0] });
});

// ── POST /api/digest ──────────────────────────────────────

/**
 * Manual digest submission.
 * Body: { digest_date?, summary_text }
 */
digest.post('/', async (c) => {
    const { digest_date, summary_text } = await c.req.json();
    if (!summary_text) return c.json({ error: 'summary_text required' }, 400);

    // Default to today VN if no date provided
    const now = new Date();
    const vnNow = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const dateStr = digest_date || vnNow.toISOString().slice(0, 10);

    await c.env.DB.prepare(
        `INSERT INTO digests (id, digest_date, created_at, updated_at, summary_text, total_fetched)
         VALUES (?, ?, ?, ?, ?, 0)
         ON CONFLICT(digest_date) DO UPDATE SET
           summary_text = excluded.summary_text,
           updated_at = excluded.updated_at`
    ).bind(
        crypto.randomUUID(), dateStr, now.toISOString(), now.toISOString(), summary_text
    ).run();

    return c.json({ ok: true, digest_date: dateStr });
});

// ── POST /api/digest/generate ─────────────────────────────

/**
 * Manual trigger digest generation.
 */
digest.post('/generate', async (c) => {
    const { scheduledDigest } = await import('../../cron/digest');
    await scheduledDigest(c.env);
    return c.json({ ok: true, message: 'Digest generation triggered' });
});

export default digest;
