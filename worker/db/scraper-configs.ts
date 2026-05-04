// ── Queries ───────────────────────────────────────────────────────────────

export async function findAll(
  db: D1Database
): Promise<Record<string, unknown>[]> {
  const { results } = await db.prepare(
    'SELECT id, domain, mode, config_json, learned_at FROM scraper_configs ORDER BY learned_at DESC'
  ).all();
  return results ?? [];
}

export async function findByDomainAndMode(
  db: D1Database,
  domain: string,
  mode: string
): Promise<string | null> {
  const { results } = await db.prepare(
    'SELECT config_json FROM scraper_configs WHERE domain = ? AND mode = ? LIMIT 1'
  ).bind(domain, mode).all<{ config_json: string }>();
  return results?.[0]?.config_json ?? null;
}

// ── Mutations ─────────────────────────────────────────────────────────────

export async function upsert(
  db: D1Database,
  domain: string,
  mode: string,
  configJson: string
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO scraper_configs (domain, mode, config_json, learned_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(domain, mode) DO UPDATE SET
       config_json = excluded.config_json,
       learned_at = excluded.learned_at`
  ).bind(domain, mode, configJson, now).run();
}

export async function deleteById(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM scraper_configs WHERE id = ?').bind(id).run();
}
