import { Env, ContentScrapeMessage } from './types';
import { scheduled } from './cron/index';
import { scheduledDigest } from './cron/digest';
import { handleContentQueue } from './queue/content-scraper';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const app = (await import('./api/index')).default;
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    // Pass cron pattern để phân biệt: general (every 3h) vs github-trending (daily)
    await scheduled(event, env, ctx, event.cron);
    // Chỉ tạo/cập nhật digest cho cron general, không cần cho github-trending
    if (event.cron !== '0 1 * * *') {
      await scheduledDigest(env);
    }
  },
  async queue(batch: MessageBatch<ContentScrapeMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    await handleContentQueue(batch, env);
  }
}
