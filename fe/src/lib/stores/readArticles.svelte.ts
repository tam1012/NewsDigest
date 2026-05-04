import type { Article } from '$lib/types';
import { getReadArticleRows, markArticleRead, type ReadArticleRow } from './cacheDb';

const rowsById = $state<Record<string, ReadArticleRow>>({});
let initialized = $state(false);

function buildSignature(article: Article): string {
  return [
    article.id,
    article.title,
    article.summary ?? '',
    article.description_vn ?? '',
    article.published_at ?? '',
  ].join('|');
}

async function init() {
  if (initialized || typeof window === 'undefined') return;
  const rows = await getReadArticleRows();
  const next: Record<string, ReadArticleRow> = {};
  for (const row of rows) {
    next[row.articleId] = row;
  }
  Object.assign(rowsById, next);
  initialized = true;
}

function isRead(article: Article): boolean {
  const row = rowsById[article.id];
  if (!row) return false;
  return row.signature === buildSignature(article);
}

async function markRead(article: Article): Promise<void> {
  const signature = buildSignature(article);
  const existing = rowsById[article.id];
  if (existing?.signature === signature) return;

  const row: ReadArticleRow = {
    articleId: article.id,
    signature,
    readAt: Date.now(),
  };

  rowsById[article.id] = row;
  await markArticleRead(row);
}

if (typeof window !== 'undefined') {
  init().catch((e) => {
    console.warn('[readArticles] init failed', e);
  });
}

export const readArticles = {
  get initialized() {
    return initialized;
  },
  isRead,
  markRead,
  init,
};
