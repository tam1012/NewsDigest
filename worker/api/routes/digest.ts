import { Hono } from 'hono';
import { Env } from '../../types';
import { DigestRepo } from '../../db';

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

    const result = await DigestRepo.findByDate(c.env.DB, dateStr);
    return c.json({ digest: result ?? null });
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

    await DigestRepo.upsert(c.env.DB, {
        date: dateStr,
        summaryText: summary_text,
        totalFetched: 0,
    });

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
