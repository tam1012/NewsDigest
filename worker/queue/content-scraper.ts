import { Env, ContentScrapeMessage } from '../types';
import { extractArticleContent } from '../cron/scraper';

/**
 * Queue Consumer — Nhận batch messages chứa article URLs,
 * cào nội dung từng bài, và cập nhật cột `content` trong D1.
 */
export async function handleContentQueue(
  batch: MessageBatch<ContentScrapeMessage>,
  env: Env
): Promise<void> {
  console.log(`📥 Processing ${batch.messages.length} articles for content scraping...`);

  for (const message of batch.messages) {
    const { articleId, url } = message.body;

    try {
      const content = await extractArticleContent(url);

      if (content) {
        await env.DB.prepare(
          "UPDATE articles SET content = ? WHERE id = ?"
        ).bind(content, articleId).run();
        console.log(`✅ Scraped content for ${url} (${content.length} chars)`);
      } else {
        console.log(`⚠️ No content extracted for ${url}`);
      }

      message.ack();
    } catch (err) {
      console.error(`❌ Failed to scrape ${url}:`, err);
      message.retry();
    }
  }

  console.log(`📥 Batch complete.`);
}
