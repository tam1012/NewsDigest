import { Env, ContentScrapeMessage } from '../types';
import { summarizeArticle } from '../ai/summarizer';
import { ProhibitedContentError, ContentUnavailableError, retryStrategy } from '../errors';
import { resolveFetcher } from './fetchers';

/**
 * Queue Consumer — Receives a batch of article URLs, fetches their content,
 * calls the AI summarizer, and updates D1.
 *
 * Content fetching is delegated to the fetcher registry (./fetchers/).
 * To add a new source type, create a fetcher module and register it there —
 * no changes needed here.
 */
export async function handleContentQueue(
  batch: MessageBatch<ContentScrapeMessage>,
  env: Env
): Promise<void> {
  console.log(`📥 Processing ${batch.messages.length} articles for content scraping...`);

  for (const message of batch.messages) {
    const { articleId, url, title } = message.body;

    try {
      // ── 1. Skip duplicates ─────────────────────────────────────────────
      const { results: existing } = await env.DB.prepare(
        'SELECT summary, content FROM articles WHERE id = ?'
      ).bind(articleId).all();

      if (existing?.[0] && (existing[0] as any).summary) {
        console.log(`⏭️ Skipping "${title}" — already summarized`);
        message.ack();
        continue;
      }

      // ── 2. Fetch content ───────────────────────────────────────────────
      let content = (existing?.[0] as any)?.content || '';

      if (!content) {
        const fetcher = resolveFetcher(url);
        content = await fetcher.fetch(url, env);

        if (content) {
          await env.DB.prepare(
            'UPDATE articles SET content = ? WHERE id = ?'
          ).bind(content, articleId).run();
          console.log(`✅ Scraped content for ${url} (${content.length} chars)`);
        }
      } else {
        console.log(`✨ Reusing existing content for "${title}" (${content.length} chars)`);
      }

      // ── 3. AI summarize ────────────────────────────────────────────────
      if (content) {
        try {
          const aiResult = await summarizeArticle(title || '', content, env);
          if (aiResult) {
            await env.DB.prepare(
              'UPDATE articles SET description_vn = ?, summary = ?, hot_score = ?, tags = ?, content = NULL WHERE id = ?'
            ).bind(
              aiResult.description_vn,
              aiResult.summary,
              aiResult.hot_score,
              JSON.stringify(aiResult.tags),
              articleId
            ).run();
            console.log(`🤖 AI: "${title}" → score=${aiResult.hot_score} tags=${aiResult.tags.join(',')}`);
          }
        } catch (aiErr: unknown) {
          if (aiErr instanceof ProhibitedContentError) {
            await env.DB.prepare(
              "UPDATE articles SET summary = '[blocked]', hot_score = 0, content = NULL WHERE id = ?"
            ).bind(articleId).run();
            const aiMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
            console.log(`🚫 AI blocked "${title}": ${aiMsg} — marked as [blocked]`);
          } else {
            const aiMsg = aiErr instanceof Error ? aiErr.message : String(aiErr);
            console.log(`⚠️ AI summarize skipped for "${title}": ${aiMsg}`);
          }
        }
      } else {
        console.log(`⚠️ No content extracted for ${url}`);
      }

      message.ack();
    } catch (err: unknown) {
      console.error(`❌ Failed to scrape ${url}:`, err);
      const strategy = retryStrategy(err, url);

      if (strategy.action === 'ack') {
        // Permanent errors (ContentUnavailableError, ConfigError, etc.)
        if (err instanceof ContentUnavailableError) {
          // Set a user-facing note so the article isn't silently blank
          await env.DB.prepare(
            'UPDATE articles SET description_vn = ? WHERE id = ? AND description_vn IS NULL'
          ).bind('📄 Content not available for this article.', articleId).run();
        }
        console.log(`🚫 Permanent error for "${title}" — acking without retry`);
        message.ack();
      } else {
        // Transient errors — retry with optional delay
        if (strategy.delaySeconds && url.includes('reddit.com')) {
          // Reddit rate-limit: set a user-facing placeholder before retry
          await env.DB.prepare(
            'UPDATE articles SET description_vn = ? WHERE id = ? AND description_vn IS NULL'
          ).bind('⏳ Reddit rate-limited — updating later.', articleId).run();
        }
        message.retry({ delaySeconds: strategy.delaySeconds });
      }
    }
  }

  console.log(`📥 Batch complete.`);
}
