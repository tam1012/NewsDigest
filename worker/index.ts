import { Env, ContentScrapeMessage } from './types';
import { scheduled } from './cron/index';
import { scheduledDigest } from './cron/digest';
import { retryFailedArticles } from './cron/retry-failed';
import { handleContentQueue } from './queue/content-scraper';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const app = (await import('./api/index')).default;
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const isRetryOnlyCron = event.cron === '*/30 * * * *';
    const isGitHubTrendingCron = event.cron === '0 1 * * *';

    if (isRetryOnlyCron) {
      // Cron 30 phút: chỉ retry bản tin lỗi, không scrape thêm nguồn mới
      await retryFailedArticles(env);
      return;
    }

    // Cron general (every 3h) hoặc github-trending (daily): scrape nguồn mới
    await scheduled(event, env, ctx, event.cron);

    // Chỉ tạo/cập nhật digest cho cron general, không cần cho github-trending
    if (!isGitHubTrendingCron) {
      await scheduledDigest(env);
    }
  },
  async queue(batch: MessageBatch<ContentScrapeMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleContentQueue(batch, env);
  }
}
