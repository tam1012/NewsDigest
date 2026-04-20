import { Env } from '../types';
import { ArticleRepo } from '../db';

export async function cleanOldContent(env: Env): Promise<void> {
  console.log(`🧹 Cleanup cron triggered at ${new Date().toISOString()}`);

  // Bài đã quá 7 ngày, chưa summarize được, nội dung cào về không còn tác dụng
  // -> SET content = NULL để dọn dẹp không để rác DB
  const oldCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  
  try {
    const changes = await ArticleRepo.cleanOldUnsummarized(env.DB, oldCutoff);

    if (changes > 0) {
      console.log(`✅ Freed content for ${changes} old articles (> 7 days).`);
    } else {
      console.log(`✅ No old articles needed cleanup.`);
    }
  } catch (error: any) {
    console.error(`❌ Cleanup failed:`, error.message);
  }
}
