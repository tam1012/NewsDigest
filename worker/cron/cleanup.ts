import { Env } from '../types';
import { ArticleRepo, DigestRepo } from '../db';

export async function cleanOldContent(env: Env): Promise<void> {
  console.log(`🧹 Cleanup cron triggered at ${new Date().toISOString()}`);

  // Retention policy: keep only last 30 days (UTC)
  const retentionDays = 30;
  const oldCutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();
  const oldDigestCutoffDate = oldCutoff.slice(0, 10);
  
  try {
    const deletedArticles = await ArticleRepo.deleteOlderThan(env.DB, oldCutoff);
    const deletedDigests = await DigestRepo.deleteOlderThanDate(env.DB, oldDigestCutoffDate);

    console.log(
      `✅ Cleanup done. Deleted ${deletedArticles} articles older than ${oldCutoff}; ` +
      `deleted ${deletedDigests} digests older than ${oldDigestCutoffDate}.`
    );
  } catch (error: any) {
    console.error(`❌ Cleanup failed:`, error.message);
  }
}
