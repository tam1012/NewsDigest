import { Source, ArticleInput } from '../../types';
import { NetworkError, RateLimitError } from '../../errors';
import { SCRAPER_SETTINGS } from '../../settings';

export async function fetchReddit(source: Source): Promise<ArticleInput[]> {
  const url = source.url.endsWith('/')
    ? `${source.url}hot.json?limit=${SCRAPER_SETTINGS.reddit.listingLimit}`
    : `${source.url}/hot.json?limit=${SCRAPER_SETTINGS.reddit.listingLimit}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'NewsDigest/1.0 (news aggregation bot)' }
  });
  if (!response.ok) {
    if (response.status === 429) throw new RateLimitError(`Reddit API rate-limited: ${response.status}`, url);
    throw new NetworkError(`Reddit API failed: ${response.status}`, response.status, url);
  }

  const data: any = await response.json();
  const children = data?.data?.children || [];

  return children
    .filter((item: any) => !item.data.stickied) // Skip pinned posts
    .filter((item: any) => {
      const d = item.data;
      // Lọc bài ít tương tác: cần ít nhất 50 upvotes HOẶC 15 comments
      return d.score >= SCRAPER_SETTINGS.reddit.minScore || d.num_comments >= SCRAPER_SETTINGS.reddit.minComments;
    })
    .map((item: any) => {
      const d = item.data;
      const postedAt = new Date(d.created_utc * 1000).toISOString();
      const meta = `⬆${d.score} 💬${d.num_comments} r/${d.subreddit} 📅${postedAt.slice(0, 10)}`;
      return {
        url: `https://www.reddit.com${d.permalink}`,
        title: d.title,
        description: d.selftext
          ? `${meta}\n${d.selftext.slice(0, SCRAPER_SETTINGS.reddit.selfTextPreviewChars)}`
          : meta,
        // Dùng thời gian fetch (now) thay vì created_utc
        // → bài hot hôm nay sẽ luôn hiện khi lọc theo "hôm nay"
        published_at: new Date().toISOString(),
        reddit_score: d.score,
        reddit_comments: d.num_comments,
      };
    });
}
