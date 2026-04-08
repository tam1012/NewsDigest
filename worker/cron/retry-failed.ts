import { Env, ContentScrapeMessage } from '../types';

const RETRY_WINDOW_DAYS = 3;
const MAX_RETRY_BATCH = 50; // tối đa 50 bài mỗi lần chạy

/**
 * Cron Retry Failed Articles — Chạy mỗi 30 phút.
 *
 * Tìm các bản tin lỗi trong 3 ngày gần nhất và re-enqueue vào CONTENT_QUEUE:
 *   1. Bài chưa cào được nội dung: content IS NULL AND summary IS NULL
 *   2. Bài đã cào content nhưng AI chưa summarize: content IS NOT NULL AND summary IS NULL
 *
 * Giới hạn trong RETRY_WINDOW_DAYS ngày để tránh retry bài quá cũ.
 */
export async function retryFailedArticles(env: Env): Promise<void> {
  console.log(`🔄 Retry-failed cron triggered at ${new Date().toISOString()}`);

  // Tính mốc thời gian: 3 ngày trước (UTC)
  const cutoff = new Date(Date.now() - RETRY_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // Lấy các bài lỗi: chưa có summary, trong cửa sổ 3 ngày
  // Bao gồm cả bài chưa cào (content NULL) và bài đã cào nhưng AI lỗi (content NOT NULL nhưng summary NULL)
  const { results } = await env.DB.prepare(
    `SELECT id, url, title, content
     FROM articles
     WHERE summary IS NULL
       AND published_at >= ?
     ORDER BY published_at DESC
     LIMIT ?`
  ).bind(cutoff, MAX_RETRY_BATCH).all<{
    id: string;
    url: string;
    title: string;
    content: string | null;
  }>();

  if (!results || results.length === 0) {
    console.log('🔄 No failed articles to retry.');
    return;
  }

  // Phân loại: bài chưa cào content vs bài đã có content nhưng chưa summarize
  const needsScraping: ContentScrapeMessage[] = [];
  const needsSummaryOnly: { id: string; url: string; title: string; content: string }[] = [];

  for (const article of results) {
    if (!article.content) {
      // Chưa cào được → enqueue lại vào CONTENT_QUEUE để cào + summarize
      needsScraping.push({ articleId: article.id, url: article.url, title: article.title });
    } else {
      // Đã có content nhưng AI chưa chạy được → chỉ cần summarize lại
      needsSummaryOnly.push({
        id: article.id,
        url: article.url,
        title: article.title,
        content: article.content,
      });
    }
  }

  console.log(
    `🔄 Found ${results.length} failed articles: ` +
    `${needsScraping.length} need scraping, ${needsSummaryOnly.length} need summary only.`
  );

  // ── 1. Re-enqueue bài chưa cào vào CONTENT_QUEUE ──────────────────────────
  if (needsScraping.length > 0) {
    // Stagger reddit bài để tránh rate limit
    const normalArticles = needsScraping.filter(a => !a.url.includes('reddit.com'));
    const redditArticles = needsScraping.filter(a => a.url.includes('reddit.com'));

    if (normalArticles.length > 0) {
      await env.CONTENT_QUEUE.sendBatch(
        normalArticles.map(a => ({ body: a }))
      );
      console.log(`🔄 Re-enqueued ${normalArticles.length} articles for scraping.`);
    }

    let redditDelay = 0;
    for (const a of redditArticles) {
      await env.CONTENT_QUEUE.send(a, { delaySeconds: redditDelay * 7 });
      redditDelay++;
    }
    if (redditArticles.length > 0) {
      console.log(`🔄 Re-enqueued ${redditArticles.length} Reddit articles (staggered).`);
    }
  }

  // ── 2. Re-enqueue bài đã có content nhưng chưa summarize ──────────────────
  // Gửi vào CONTENT_QUEUE như bình thường — content-scraper sẽ detect content có sẵn
  // Thực ra content-scraper luôn cào lại, nhưng bài đã có summary sẽ bị skip.
  // Với bài chưa có summary nhưng đã có content → enqueue lại cho content-scraper xử lý.
  if (needsSummaryOnly.length > 0) {
    const messages: ContentScrapeMessage[] = needsSummaryOnly.map(a => ({
      articleId: a.id,
      url: a.url,
      title: a.title,
    }));
    await env.CONTENT_QUEUE.sendBatch(messages.map(a => ({ body: a })));
    console.log(`🔄 Re-enqueued ${needsSummaryOnly.length} articles for AI summarization.`);
  }

  console.log(`🔄 Retry-failed done. Total re-enqueued: ${needsScraping.length + needsSummaryOnly.length} articles.`);
}
