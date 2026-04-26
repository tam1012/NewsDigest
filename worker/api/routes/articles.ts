import { Hono } from 'hono';
import { Env } from '../../types';
import { ArticleRepo } from '../../db';
import { requireAdmin } from '../utils';
import { assertSafePublicHttpUrl } from '../../utils/url-safety';

const articles = new Hono<{ Bindings: Env }>();

// ── GET /api/articles ─────────────────────────────────────

articles.get('/', async (c) => {
    const page = parseInt(c.req.query('page') || '1');
    const limit = Math.min(parseInt(c.req.query('limit') || '20'), 200);
    const tag = c.req.query('tag') || '';
    const sourceId = c.req.query('source_id') || '';
    const minHot = parseInt(c.req.query('min_hot') || '0');
    const sort = c.req.query('sort') === 'hot' ? 'hot' as const : 'date' as const;

    const unsummarized = c.req.query('unsummarized');
    const compact = c.req.query('compact');
    const ids = c.req.query('ids');

    const idList = ids ? ids.split(',').map(s => s.trim()).filter(Boolean) : undefined;

    const result = await ArticleRepo.findPaginated(c.env.DB, {
        tag: tag || undefined,
        sourceId: sourceId || undefined,
        minHot,
        from: c.req.query('from') || undefined,
        to: c.req.query('to') || undefined,
        ids: idList,
        unsummarized: unsummarized === '1',
        compact: compact === '1',
        sort,
        page,
        limit,
    });

    return c.json({ articles: result.articles, total: result.total, page: result.page, nextPage: result.nextPage });
});

// ── GET /api/articles/:id ─────────────────────────────────

articles.get('/:id', async (c) => {
    const id = c.req.param('id');
    const article = await ArticleRepo.findById(c.env.DB, id);
    if (!article) return c.json({ error: 'Not found' }, 404);
    return c.json({ article });
});

// ── POST /api/articles/enrich ─────────────────────────────

/**
 * Fetch nội dung bài viết từ URL gốc cho các article chưa có content.
 * Body: { ids: ["id1", "id2", ...], force?: boolean }
 * Sẽ fetch song song (tối đa 5 cùng lúc) và update content vào DB.
 */
articles.post('/enrich', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const body = await c.req.json();
    const ids = body.ids;
    const force = body.force === true;

    if (!Array.isArray(ids) || ids.length === 0) {
        return c.json({ error: 'ids array required' }, 400);
    }

    const articleList = await ArticleRepo.findByIds(c.env.DB, ids);

    if (articleList.length === 0) {
        return c.json({ ok: true, enriched: 0, message: 'No articles found' });
    }

    const { extractArticleContent } = await import('../../scraper');
    const enrichResults: { id: string; success: boolean; chars: number; skipped?: boolean; note?: string }[] = [];

    // Kiểm tra content có phải rác không
    function isLowQuality(text: string | null): boolean {
        if (!text || text.length < 100) return true;
        // HN RSS metadata
        if (text.includes('Article URL:') && text.includes('Points:')) return true;
        // Reddit navigation
        if (text.includes('Skip to main content') || text.includes('Go to Reddit Home')) return true;
        // Chủ yếu HTML tags
        const stripped = text.replace(/<[^>]+>/g, '').trim();
        if (stripped.length < 100) return true;
        return false;
    }

    // Trích xuất URL bài gốc từ HN RSS description
    function extractHNArticleUrl(description: string): string | null {
        const match = description.match(/Article URL:\s*<a href="([^"]+)"/);
        return match ? match[1] : null;
    }

    for (let i = 0; i < articleList.length; i += 5) {
        const batch = articleList.slice(i, i + 5);
        const promises = batch.map(async (art) => {
            // Skip nếu đã có content tốt (trừ khi force=true)
            if (!force && art.content && !isLowQuality(art.content)) {
                return { id: art.id, success: true, chars: art.content.length, skipped: true };
            }

            // Skip Reddit URLs (JS-rendered, không extract được)
            if (art.url.includes('reddit.com')) {
                return { id: art.id, success: false, chars: 0, note: 'Reddit URLs are JS-rendered' };
            }

            // Xác định URL cần fetch
            let fetchUrl = art.url;

            // Nếu bài HN, lấy article URL thay vì HN page
            if (art.description && extractHNArticleUrl(art.description)) {
                fetchUrl = extractHNArticleUrl(art.description)!;
            } else if (art.url.includes('news.ycombinator.com')) {
                // Ask HN / Show HN — nội dung nằm trong RSS description, chỉ cần strip HTML
                if (art.description) {
                    const cleaned = art.description
                        .replace(/<hr\s*\/?>/gi, '\n---\n')
                        .replace(/<p>/gi, '\n')
                        .replace(/<[^>]+>/g, '')
                        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
                        // Loại bỏ metadata cuối (Comments URL, Points)
                        .replace(/\n---\n[\s\S]*$/, '')
                        .trim();
                    if (cleaned.length > 50) {
                        await ArticleRepo.updateContent(c.env.DB, art.id, cleaned);
                        return { id: art.id, success: true, chars: cleaned.length };
                    }
                }
                return { id: art.id, success: false, chars: 0, note: 'HN text post with no content' };
            }

            const safeFetchUrl = assertSafePublicHttpUrl(fetchUrl).toString();
            const content = await extractArticleContent(safeFetchUrl, c.env);
            if (content && content.length > 50) {
                await ArticleRepo.updateContent(c.env.DB, art.id, content);
                return { id: art.id, success: true, chars: content.length };
            }
            return { id: art.id, success: false, chars: 0, note: 'Could not extract content' };
        });

        const batchResults = await Promise.all(promises);
        enrichResults.push(...batchResults);
    }

    const enriched = enrichResults.filter(r => r.success && !r.skipped).length;
    return c.json({ ok: true, enriched, total: articleList.length, results: enrichResults });
});

// ── POST /api/articles/enqueue-scrape ────────────────────

/**
 * Enqueue articles chưa có content vào Queue để cào nội dung.
 * Body (optional): { limit?: number, force?: boolean }
 * - limit: số lượng tối đa (default 50)
 * - force: true = enqueue cả những bài đã có content
 */
articles.post('/enqueue-scrape', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const body = await c.req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 50, 200);
    const force = body.force === true;

    const results = await ArticleRepo.findForEnqueue(c.env.DB, limit, force);

    if (results.length === 0) {
        return c.json({ ok: true, enqueued: 0, message: 'No articles to scrape' });
    }

    const normalArticles = results.filter(a => !a.url.includes('reddit.com'));
    const redditArticles = results.filter(a => a.url.includes('reddit.com'));

    // Enqueue normal articles in batches of 25 (Queue limit per sendBatch)
    let enqueued = 0;
    for (let i = 0; i < normalArticles.length; i += 25) {
        const batch = normalArticles.slice(i, i + 25);
        await c.env.CONTENT_QUEUE.sendBatch(
            batch.map(a => ({ body: { articleId: a.id, url: a.url, title: a.title } }))
        );
        enqueued += batch.length;
    }

    // Enqueue Reddit articles with staggered delays (15s apart) using sendBatch
    // sendBatch supports per-message delaySeconds → giảm N subrequests xuống còn ceil(N/100)
    for (let i = 0; i < redditArticles.length; i += 100) {
        const chunk = redditArticles.slice(i, i + 100);
        await c.env.CONTENT_QUEUE.sendBatch(
            chunk.map((a, j) => ({
                body: { articleId: a.id, url: a.url, title: a.title },
                delaySeconds: (i + j) * 15,
            }))
        );
        enqueued += chunk.length;
    }

    return c.json({ ok: true, enqueued, message: `Enqueued ${enqueued} articles for content scraping` });
});

// ── POST /api/articles/resummarize ───────────────────────

/**
 * Retry AI summarization cho các bài đã có content nhưng chưa có summary
 * (do Gemini bị overload/rate-limit lúc scrape).
 * Body (optional): { limit?: number, delayMs?: number }
 * - limit: số bài tối đa (default 20, max 100)
 * - delayMs: delay giữa mỗi lần gọi Gemini (default 3000ms)
 */
articles.post('/resummarize', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const body = await c.req.json().catch(() => ({}));
    const limit = Math.min(body.limit || 20, 100);
    const delayMs = Math.max(body.delayMs || 3000, 1000);

    const results = await ArticleRepo.findForResummarize(c.env.DB, limit);

    if (results.length === 0) {
        return c.json({ ok: true, summarized: 0, failed: 0, total: 0, message: 'No unsummarized articles with content found' });
    }

    const { summarizeArticle } = await import('../../ai/summarizer');
    const summaryResults: { id: string; title: string; success: boolean; error?: string }[] = [];
    let summarized = 0;
    let failed = 0;

    for (let i = 0; i < results.length; i++) {
        const art = results[i];
        try {
            const aiResult = await summarizeArticle(art.title || '', art.content, c.env);
            if (aiResult) {
                await ArticleRepo.updateSummary(c.env.DB, art.id, aiResult);
                summarized++;
                summaryResults.push({ id: art.id, title: art.title, success: true });
                console.log(`🔄 Resummarized [${i + 1}/${results.length}]: "${art.title}" → score=${aiResult.hot_score}`);
            } else {
                failed++;
                summaryResults.push({ id: art.id, title: art.title, success: false, error: 'AI returned null' });
            }
        } catch (err: any) {
            failed++;
            summaryResults.push({ id: art.id, title: art.title, success: false, error: err.message });
            console.log(`⚠️ Resummarize failed [${i + 1}/${results.length}]: "${art.title}" — ${err.message}`);
            // Nếu 429, tăng delay lên gấp đôi cho các bài còn lại
            if (err.message?.includes('429')) {
                console.log(`⏳ Rate limited — doubling delay for remaining articles`);
                await new Promise(r => setTimeout(r, delayMs * 2));
                continue;
            }
        }

        // Delay giữa mỗi lần gọi (trừ bài cuối)
        if (i < results.length - 1) {
            await new Promise(r => setTimeout(r, delayMs));
        }
    }

    return c.json({ ok: true, summarized, failed, total: results.length, results: summaryResults });
});

export default articles;
