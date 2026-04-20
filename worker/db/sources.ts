import { Source } from '../types';

// ── Queries ───────────────────────────────────────────────────────────────

export async function findAllEnabled(db: D1Database): Promise<Source[]> {
  const { results } = await db.prepare(
    'SELECT * FROM sources WHERE enabled = 1 ORDER BY created_at'
  ).all<Source>();
  return results ?? [];
}

export async function findById(db: D1Database, id: string): Promise<Source | null> {
  const { results } = await db.prepare('SELECT * FROM sources WHERE id = ?').bind(id).all<Source>();
  return results?.[0] ?? null;
}

/** List all sources with article_count and summarized_count (for API). */
export async function findAllWithStats(db: D1Database): Promise<Record<string, unknown>[]> {
  const { results } = await db.prepare(`
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
  return results ?? [];
}

// ── Mutations ─────────────────────────────────────────────────────────────

export async function insert(
  db: D1Database,
  params: { id: string; url: string; name: string; type: string; channel_id: string | null; enabled: number }
): Promise<void> {
  await db.prepare(
    'INSERT INTO sources (id, url, name, type, channel_id, enabled) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(params.id, params.url, params.name, params.type, params.channel_id, params.enabled).run();
}

export async function updateLastFetched(db: D1Database, id: string): Promise<string> {
  const now = new Date().toISOString();
  await db.prepare('UPDATE sources SET last_fetched_at = ? WHERE id = ?').bind(now, id).run();
  return now;
}

export async function updateChannelId(db: D1Database, id: string, channelId: string): Promise<void> {
  await db.prepare('UPDATE sources SET channel_id = ? WHERE id = ?').bind(channelId, id).run();
}

/** Dynamic PATCH update. */
export async function update(
  db: D1Database,
  id: string,
  fields: { enabled?: number; name?: string; channel_id?: string; url?: string; type?: string }
): Promise<void> {
  const sets: string[] = [];
  const binds: any[] = [];

  if (fields.enabled !== undefined) { sets.push('enabled = ?'); binds.push(fields.enabled); }
  if (fields.name !== undefined) { sets.push('name = ?'); binds.push(fields.name); }
  if (fields.channel_id !== undefined) { sets.push('channel_id = ?'); binds.push(fields.channel_id); }
  if (fields.url !== undefined) { sets.push('url = ?'); binds.push(fields.url); }
  if (fields.type !== undefined) { sets.push('type = ?'); binds.push(fields.type); }

  if (sets.length === 0) return;
  binds.push(id);
  await db.prepare(`UPDATE sources SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
}

/** Delete source and all its articles (batch). */
export async function deleteWithArticles(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM articles WHERE source_id = ?').bind(id),
    db.prepare('DELETE FROM sources WHERE id = ?').bind(id),
  ]);
}
