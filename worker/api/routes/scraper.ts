import { Hono } from 'hono';
import { Env } from '../../types';
import { ScraperConfigRepo } from '../../db';
import { requireAdmin } from '../utils';
import { SCRAPER_SETTINGS } from '../../settings';

const scraper = new Hono<{ Bindings: Env }>();

// ── GET /api/scraper-configs ──────────────────────────────

/**
 * List all learned scraper profiles.
 */
scraper.get('/scraper-configs', async (c) => {
    const configs = await ScraperConfigRepo.findAll(c.env.DB);
    return c.json({ configs });
});

// ── DELETE /api/scraper-configs/:id ──────────────────────

/**
 * Delete a specific scraper profile.
 */
scraper.delete('/scraper-configs/:id', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const id = c.req.param('id');
    await ScraperConfigRepo.deleteById(c.env.DB, id);
    return c.json({ ok: true });
});

// ── POST /api/scraper-profile/test ───────────────────────

/**
 * Manually trigger profile learning for a URL.
 * Body: { url: string, mode?: 'article' | 'listing' }
 *
 * - mode='article' (default): Learn content extraction selectors for an article page.
 * - mode='listing': Learn link extraction selectors for a listing/index page.
 *
 * Returns the generated profile, extraction results, and whether it was saved.
 */
scraper.post('/scraper-profile/test', async (c) => {
    const authErr = requireAdmin(c);
    if (authErr) return authErr;

    const body = await c.req.json().catch(() => ({}));
    const url = body.url;
    const mode = body.mode || 'article';
    const save = body.save !== false; // default: save to DB

    if (!url || typeof url !== 'string') {
        return c.json({ error: 'url is required' }, 400);
    }
    if (mode !== 'article' && mode !== 'listing') {
        return c.json({ error: 'mode must be "article" or "listing"' }, 400);
    }

    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml',
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(SCRAPER_SETTINGS.sourceFetch.htmlTimeoutMs),
        });

        if (!response.ok) {
            return c.json({ error: `Fetch failed: ${response.status}` }, 400);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('text/html')) {
            return c.json({ error: `Not HTML: ${contentType}` }, 400);
        }

        const finalUrl = response.url || url;
        const domain = new URL(finalUrl).hostname.replace(/^www\./, '').toLowerCase();
        const html = await response.text();

        // Sanitize HTML for AI
        const cleanedHtml = html
            .replace(/<script[\s\S]*?<\/script>/gi, ' ')
            .replace(/<style[\s\S]*?<\/style>/gi, ' ')
            .replace(/<!--[\s\S]*?-->/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();

        if (mode === 'article') {
            return testArticleProfile(c, { url, finalUrl, domain, html, cleanedHtml, save });
        } else {
            return testListingProfile(c, { url, finalUrl, domain, html, cleanedHtml, save });
        }
    } catch (err: any) {
        return c.json({ error: err.message || 'Unknown error' }, 500);
    }
});

// ── Helpers ───────────────────────────────────────────────

interface ProfileTestContext {
    url: string;
    finalUrl: string;
    domain: string;
    html: string;
    cleanedHtml: string;
    save: boolean;
}

async function testArticleProfile(c: any, { finalUrl, domain, html, cleanedHtml, save }: ProfileTestContext) {
    const { callGemini, extractJson, normalizeConfig } = await import('../../ai/scraper-profile');
    const { extractFromHtmlWithProfile, normalizeProfile } = await import('../../scraper');
    const { resolveStaticProfile } = await import('../../cron/site-profiles');

    const ARTICLE_SYSTEM_PROMPT = `
You are an expert web scraping engineer.
Return only valid JSON with this exact schema:
{
  "contentSelectors": ["..."],
  "removeSelectors": ["..."],
  "minLength": 40,
  "confidence": 0.0
}

Rules:
- contentSelectors must target article body containers, most-specific first.
- removeSelectors must remove ads/navigation/sidebar/related/comments/noise.
- Never use overly generic selectors in contentSelectors: html, body, *, main, [role="main"].
- Prefer stable class/id/attribute selectors.
- minLength range 20..300.
- confidence range 0..1.
- Do not include markdown, explanations, or extra keys.
`;

    const prompt = [
        `Domain: ${domain}`,
        `Sample URL: ${finalUrl}`,
        'Task: infer robust selectors for article content extraction.',
        'HTML sample:',
        cleanedHtml.slice(0, SCRAPER_SETTINGS.aiProfile.htmlSampleChars),
    ].join('\n\n');

    const debug: Record<string, any> = {
        html_length: html.length,
        cleaned_html_length: cleanedHtml.length,
        prompt_length: prompt.length,
    };

    // Step 1: Call AI
    let rawAiResponse: string;
    const modelUsed = 'gemma-4 (auto-selected)';
    try {
        rawAiResponse = await callGemini(c.env, ARTICLE_SYSTEM_PROMPT, prompt);
    } catch (err: any) {
        return c.json({ ok: false, domain, mode: 'article', step_failed: 'callGemini', error: err.message, debug });
    }
    debug.model_used = modelUsed;
    debug.ai_raw_response = rawAiResponse.slice(0, SCRAPER_SETTINGS.aiProfile.debugPreviewChars);
    debug.ai_raw_length = rawAiResponse.length;

    // Step 2: Extract JSON
    let parsed: any;
    try {
        parsed = extractJson(rawAiResponse);
        debug.parsed_json = parsed;
    } catch (err: any) {
        return c.json({ ok: false, domain, mode: 'article', step_failed: 'extractJson', error: err.message, debug });
    }

    // Step 3: Normalize
    const aiProfile = normalizeConfig(parsed);
    debug.normalized_profile = aiProfile;

    if (!aiProfile) {
        return c.json({
            ok: false, domain, mode: 'article',
            step_failed: 'normalizeConfig',
            message: 'normalizeConfig returned null — contentSelectors likely empty after filtering generic ones',
            static_profile: resolveStaticProfile(finalUrl),
            debug,
        });
    }

    aiProfile.sampleUrl = finalUrl;
    const staticProfile = resolveStaticProfile(finalUrl);

    // Step 4: Extract content with both profiles for comparison
    const aiSiteProfile = normalizeProfile(aiProfile);
    const aiExtraction = await extractFromHtmlWithProfile(html, aiSiteProfile);
    const staticExtraction = await extractFromHtmlWithProfile(html, staticProfile);

    // Save if requested
    let saved = false;
    if (save) {
        await ScraperConfigRepo.upsert(c.env.DB, domain, 'html', JSON.stringify(aiProfile));
        saved = true;
    }

    return c.json({
        ok: true, domain, mode: 'article', saved,
        ai_profile: aiProfile,
        ai_extraction: {
            chars: aiExtraction.text.length,
            paragraphs: aiExtraction.paragraphs,
            matched: aiExtraction.anyContentSelectorMatched,
            preview: aiExtraction.text.slice(0, SCRAPER_SETTINGS.aiProfile.articlePreviewChars),
        },
        static_profile: {
            matchedKey: staticProfile.matchedKey,
            contentSelectors: staticProfile.contentSelectors,
            removeSelectors: staticProfile.removeSelectors,
        },
        static_extraction: {
            chars: staticExtraction.text.length,
            paragraphs: staticExtraction.paragraphs,
            matched: staticExtraction.anyContentSelectorMatched,
            preview: staticExtraction.text.slice(0, SCRAPER_SETTINGS.aiProfile.articlePreviewChars),
        },
        debug,
    });
}

async function testListingProfile(c: any, { finalUrl, domain, html, cleanedHtml, save }: ProfileTestContext) {
    const { callGemini, extractJson, normalizeListingConfig } = await import('../../ai/scraper-profile');
    const { extractListingWithSelectorSet, buildListingArticles, normalizeListingProfile } = await import('../../scraper');

    const LISTING_SYSTEM_PROMPT = `
You are an expert web scraping engineer.
Return only valid JSON with this exact schema:
{
  "linkSelectors": ["..."],
  "removeSelectors": ["..."],
  "confidence": 0.0
}

Rules:
- linkSelectors must target links to article detail pages on listing/archive/home pages.
- Never use overly generic selectors: a, body a, html a, *.
- Prefer stable container+link selectors (for example ".post-item a.card-link").
- removeSelectors should remove nav/footer/sidebar/ads/promo/newsletter blocks.
- confidence range 0..1.
- Do not include markdown, explanations, or extra keys.
`;

    const prompt = [
        `Domain: ${domain}`,
        `Sample URL: ${finalUrl}`,
        'Task: infer robust selectors for extracting article links from a listing page.',
        'HTML sample:',
        cleanedHtml.slice(0, SCRAPER_SETTINGS.aiProfile.htmlSampleChars),
    ].join('\n\n');

    const debug: Record<string, any> = {
        html_length: html.length,
        cleaned_html_length: cleanedHtml.length,
    };

    // Step 1: Call AI
    let rawAiResponse: string;
    const modelUsed = 'gemma-4 (auto-selected)';
    try {
        rawAiResponse = await callGemini(c.env, LISTING_SYSTEM_PROMPT, prompt);
    } catch (err: any) {
        return c.json({ ok: false, domain, mode: 'listing', step_failed: 'callGemini', error: err.message, debug });
    }
    debug.model_used = modelUsed;
    debug.ai_raw_response = rawAiResponse.slice(0, SCRAPER_SETTINGS.aiProfile.debugPreviewChars);

    // Step 2: Parse & normalize
    let parsed: any;
    try {
        parsed = extractJson(rawAiResponse);
    } catch (err: any) {
        return c.json({ ok: false, domain, mode: 'listing', step_failed: 'extractJson', error: err.message, debug });
    }

    const aiProfile = normalizeListingConfig(parsed);
    if (!aiProfile) {
        return c.json({
            ok: false, domain, mode: 'listing',
            step_failed: 'normalizeListingConfig',
            message: 'linkSelectors empty after filtering generic ones',
            parsed_json: parsed,
            debug,
        });
    }
    aiProfile.sampleUrl = finalUrl;

    // Step 3: Extract links using AI profile
    const sourceHost = new URL(finalUrl).hostname.replace(/^www\./, '').toLowerCase();
    const aiSelectors = normalizeListingProfile(aiProfile);
    const aiCandidates = await extractListingWithSelectorSet(html, aiSelectors, finalUrl, sourceHost);
    const aiArticles = buildListingArticles(aiCandidates);

    // Also extract with default 'a[href]' for comparison
    const defaultCandidates = await extractListingWithSelectorSet(
        html,
        { linkSelectors: ['a[href]'], removeSelectors: [] },
        finalUrl,
        sourceHost
    );
    const defaultArticles = buildListingArticles(defaultCandidates);

    // Save if requested
    let saved = false;
    if (save) {
        await ScraperConfigRepo.upsert(c.env.DB, domain, 'listing', JSON.stringify(aiProfile));
        saved = true;
    }

    return c.json({
        ok: true, domain, mode: 'listing', saved,
        ai_profile: aiProfile,
        ai_articles: {
            count: aiArticles.length,
            items: aiArticles.map(a => ({ url: a.url, title: a.title })),
        },
        default_articles: {
            count: defaultArticles.length,
            items: defaultArticles.slice(0, SCRAPER_SETTINGS.aiProfile.listingPreviewItems).map(a => ({ url: a.url, title: a.title })),
        },
        debug,
    });
}

export default scraper;
