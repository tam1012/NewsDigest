import { Env, ContentScrapeMessage } from './types';
import { scheduled } from './cron/index';
import { scheduledDigest } from './cron/digest';
import { retryFailedArticles } from './cron/retry-failed';
import { cleanOldContent } from './cron/cleanup';
import { handleContentQueue } from './queue/content-scraper';
import { SCRAPER_SETTINGS } from './settings';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const app = (await import('./api/index')).default;
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const isRetryOnlyCron = event.cron === SCRAPER_SETTINGS.cron.retryFailed;
    const isGitHubTrendingCron = event.cron === SCRAPER_SETTINGS.cron.githubTrending;
    const isRetentionCleanupCron = event.cron === SCRAPER_SETTINGS.cron.cleanup;

    if (isRetryOnlyCron) {
      // Cron 30 phút: chỉ retry bản tin lỗi, không scrape thêm nguồn mới
      await retryFailedArticles(env);
      return;
    }

    if (isRetentionCleanupCron) {
      // Cron daily at 23:30 UTC: dọn dữ liệu cũ theo retention policy
      await cleanOldContent(env);
      return;
    }

    // Cron general (every 3h) hoặc github-trending (daily): scrape nguồn mới
    await scheduled(event, env, ctx, event.cron);

    // Chỉ tạo/cập nhật digest cho cron general, không cần cho github-trending
    if (!isGitHubTrendingCron) {
      await scheduledDigest(env);
    } else {
      // Cron daily (github-trending) chạy 1 lần lúc 01:00 UTC
    }
  },
  async queue(batch: MessageBatch<ContentScrapeMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleContentQueue(batch, env);
  }
}
