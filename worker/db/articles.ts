import { Article, ContentScrapeMessage } from '../types';

// ── Types ─────────────────────────────────────────────────────────────────

export interface ArticleInsertParams {
  id: string;
  source_id: string;
  url: string;
  title: string;
  description: string | null;
  published_at: string;
}

export interface SummaryResult {
  description_vn: string;
  summary: string;
  hot_score: number;
  tags: string[];
}

export interface PaginatedFilters {
  tag?: string;
  sourceId?: string;
  minHot?: number;
  from?: string;
  to?: string;
  ids?: string[];
  unsummarized?: boolean;
  compact?: boolean;
  sort?: 'hot' | 'date';
  page?: number;
  limit?: number;
}

export interface PaginatedResult {
  articles: Record<string, unknown>[];
  total: number;
  page: number;
  nextPage: number | null;
}

export interface DeduoCheckRow {
  id: string;
  published_at: string;
  description: string | null;
  summary: string | null;
  content: string | null;
}

// ── Single-row queries ────────────────────────────────────────────────────

export async function findById(db: D1Database, id: string): Promise<Article | null> {
  const { results } = await db.prepare('SELECT * FROM articles WHERE id = ?').bind(id).all<Article>();
  return results?.[0] ?? null;
}

export async function findBySourceAndUrl(
  db: D1Database,
  sourceId: string,
  url: string
): Promise<DeduoCheckRow | null> {
  const { results } = await db.prepare(
    'SELECT id, published_at, description, summary, content FROM articles WHERE source_id = ? AND url = ?'
  ).bind(sourceId, url).all<DeduoCheckRow>();
  return results?.[0] ?? null;
}

/** Check if an article already has a summary (queue dedup). */
export async function findSummaryStatus(
  db: D1Database,
  id: string
): Promise<{ summary: string | null; content: string | null } | null> {
  const { results } = await db.prepare(
    'SELECT summary, content FROM articles WHERE id = ?'
  ).bind(id).all<{ summary: string | null; content: string | null }>();
  return results?.[0] ?? null;
}

// ── List queries ──────────────────────────────────────────────────────────

export async function findForDigest(
  db: D1Database,
  from: string,
  to: string
): Promise<{ id: string; title: string; summary: string; hot_score: number }[]> {
  const { results } = await db.prepare(
    `SELECT id, title, summary, hot_score
     FROM articles
     WHERE summary IS NOT NULL
       AND published_at >= ?
       AND published_at < ?
     ORDER BY hot_score DESC
     LIMIT 50`
  ).bind(from, to).all<{ id: string; title: string; summary: string; hot_score: number }>();
  return results ?? [];
}

export async function findFailed(
  db: D1Database,
  cutoff: string,
  limit: number
): Promise<{ id: string; url: string; title: string; content: string | null }[]> {
  const { results } = await db.prepare(
    `SELECT id, url, title, content
     FROM articles
     WHERE summary IS NULL
       AND published_at >= ?
     ORDER BY published_at DESC
     LIMIT ?`
  ).bind(cutoff, limit).all<{ id: string; url: string; title: string; content: string | null }>();
  return results ?? [];
}

export async function findForResummarize(
  db: D1Database,
  limit: number
): Promise<{ id: string; title: string; content: string }[]> {
  const { results } = await db.prepare(
    `SELECT id, title, content FROM articles
     WHERE content IS NOT NULL AND content != '' AND summary IS NULL
     ORDER BY fetched_at DESC LIMIT ?`
  ).bind(limit).all<{ id: string; title: string; content: string }>();
  return results ?? [];
}

export async function findForEnqueue(
  db: D1Database,
  limit: number,
  force: boolean
): Promise<{ id: string; url: string; title: string }[]> {
  const condition = force ? '1=1' : 'summary IS NULL';
  const { results } = await db.prepare(
    `SELECT id, url, title FROM articles WHERE ${condition} ORDER BY fetched_at DESC LIMIT ?`
  ).bind(limit).all<{ id: string; url: string; title: string }>();
  return results ?? [];
}

export async function findByIds(
  db: D1Database,
  ids: string[]
): Promise<{ id: string; url: string; description: string | null; content: string | null }[]> {
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db.prepare(
    `SELECT id, url, description, content FROM articles WHERE id IN (${placeholders})`
  ).bind(...ids).all<{ id: string; url: string; description: string | null; content: string | null }>();
  return results ?? [];
}

// ── Paginated listing (dynamic filters) ───────────────────────────────────

export async function findPaginated(db: D1Database, filters: PaginatedFilters): Promise<PaginatedResult> {
  const page = filters.page ?? 1;
  const limit = Math.min(filters.limit ?? 20, 200);
  const offset = (page - 1) * limit;
  const sort = filters.sort === 'hot' ? 'hot_score DESC' : 'published_at DESC';

  const fields = filters.compact
    ? 'id, title, url, source_id, published_at'
    : 'id, source_id, url, title, summary, description, description_vn, hot_score, tags, published_at, fetched_at';

  let where = 'WHERE 1=1';
  const binds: any[] = [];

  if (filters.ids && filters.ids.length > 0) {
    where += ` AND id IN (${filters.ids.map(() => '?').join(',')})`;
    binds.push(...filters.ids);
  }
  if (filters.tag) { where += ' AND tags LIKE ?'; binds.push(`%"${filters.tag}"%`); }
  if (filters.sourceId) { where += ' AND source_id = ?'; binds.push(filters.sourceId); }
  if (filters.minHot && filters.minHot > 0) { where += ' AND hot_score >= ?'; binds.push(filters.minHot); }
  if (filters.unsummarized) { where += ' AND summary IS NULL'; }
  if (filters.from) { where += ' AND published_at >= ?'; binds.push(filters.from); }
  if (filters.to) { where += ' AND published_at < ?'; binds.push(filters.to); }

  const countStmt = db.prepare(`SELECT COUNT(*) as total FROM articles ${where}`);
  const dataStmt = db.prepare(
    `SELECT ${fields} FROM articles ${where} ORDER BY ${sort} LIMIT ? OFFSET ?`
  );

  const countBinds = [...binds];
  const dataBinds = [...binds, limit, offset];

  const [countRes, dataRes] = await Promise.all([
    countBinds.length > 0 ? countStmt.bind(...countBinds).all() : countStmt.all(),
    dataBinds.length > 0 ? dataStmt.bind(...dataBinds).all() : dataStmt.all(),
  ]);

  const total = (countRes.results[0] as any)?.total || 0;
  return {
    articles: dataRes.results as Record<string, unknown>[],
    total,
    page,
    nextPage: offset + limit < total ? page + 1 : null,
  };
}

// ── Inserts ───────────────────────────────────────────────────────────────

export async function insert(db: D1Database, params: ArticleInsertParams): Promise<void> {
  await db.prepare(
    `INSERT INTO articles (id, source_id, url, title, description, published_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(params.id, params.source_id, params.url, params.title, params.description, params.published_at).run();
}

/** INSERT OR IGNORE — returns number of rows changed (0 = duplicate skipped). */
export async function insertOrIgnore(db: D1Database, params: ArticleInsertParams): Promise<number> {
  const result = await db.prepare(
    `INSERT OR IGNORE INTO articles (id, source_id, url, title, description, published_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(params.id, params.source_id, params.url, params.title, params.description, params.published_at).run();
  return result.meta?.changes ?? 0;
}

// ── Updates ───────────────────────────────────────────────────────────────

export async function updateContent(db: D1Database, id: string, content: string): Promise<void> {
  await db.prepare('UPDATE articles SET content = ? WHERE id = ?').bind(content, id).run();
}

export async function updateSummary(db: D1Database, id: string, result: SummaryResult): Promise<void> {
  await db.prepare(
    'UPDATE articles SET description_vn = ?, summary = ?, hot_score = ?, tags = ?, content = NULL WHERE id = ?'
  ).bind(result.description_vn, result.summary, result.hot_score, JSON.stringify(result.tags), id).run();
}

export async function updateBlocked(db: D1Database, id: string): Promise<void> {
  await db.prepare(
    "UPDATE articles SET summary = '[blocked]', hot_score = 0, content = NULL WHERE id = ?"
  ).bind(id).run();
}

export async function updateDescriptionVn(db: D1Database, id: string, text: string): Promise<void> {
  await db.prepare(
    'UPDATE articles SET description_vn = ? WHERE id = ? AND description_vn IS NULL'
  ).bind(text, id).run();
}

export async function updateDescription(db: D1Database, id: string, description: string | null): Promise<void> {
  await db.prepare('UPDATE articles SET description = ? WHERE id = ?').bind(description, id).run();
}

/** Reset AI fields for re-processing (Reddit/GitHub-Trending refresh). */
export async function resetForReprocessing(
  db: D1Database,
  id: string,
  publishedAt: string
): Promise<void> {
  await db.prepare(
    'UPDATE articles SET published_at = ?, summary = NULL, description_vn = NULL, hot_score = NULL, tags = NULL WHERE id = ?'
  ).bind(publishedAt, id).run();
}

/** Cleanup old content for articles that never got summarized. */
export async function cleanOldUnsummarized(db: D1Database, cutoff: string): Promise<number> {
  const result = await db.prepare(
    'UPDATE articles SET content = NULL WHERE summary IS NULL AND content IS NOT NULL AND published_at < ?'
  ).bind(cutoff).run();
  return result.meta?.changes ?? 0;
}

export async function deleteBySourceId(db: D1Database, sourceId: string): Promise<void> {
  await db.prepare('DELETE FROM articles WHERE source_id = ?').bind(sourceId).run();
}

// ── Batch operations ──────────────────────────────────────────────────────

/** Batch update summary fields (used by Dify integration). */
export async function batchUpdateSummary(
  db: D1Database,
  items: { id: string; summary: string; hot_score?: number; tags?: string[] }[]
): Promise<number> {
  const statements = items
    .filter(item => item.id && item.summary)
    .map(item =>
      db.prepare('UPDATE articles SET summary = ?, hot_score = ?, tags = ? WHERE id = ?')
        .bind(item.summary, item.hot_score || 5, JSON.stringify(item.tags || []), item.id)
    );

  if (statements.length > 0) {
    await db.batch(statements);
  }
  return statements.length;
}
