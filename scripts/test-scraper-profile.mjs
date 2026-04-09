/**
 * Test script cho các pure functions trong scraper-profile feature.
 * Chạy: node scripts/test-scraper-profile.mjs
 */

let passed = 0;
let failed = 0;

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

// ─── Helpers copied/ported from TS source ────────────────────────────────────

function isContentSelectorTooGeneric(selector) {
  const s = selector.trim().toLowerCase();
  return s === 'html' || s === 'body' || s === '*' || s === 'main' || s === '[role="main"]';
}

function isListingSelectorTooGeneric(selector) {
  const s = selector.trim().toLowerCase();
  return s === 'a' || s === 'body a' || s === 'html a' || s === '*';
}

function normalizeSelectorArray(value, maxItems) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const selector = item.trim();
    if (!selector) continue;
    if (selector.length > 180) continue;
    out.push(selector);
    if (out.length >= maxItems) break;
  }
  return [...new Set(out)];
}

function normalizeConfig(input) {
  const contentSelectors = normalizeSelectorArray(input?.contentSelectors, 8)
    .filter((s) => !isContentSelectorTooGeneric(s));
  const removeSelectors = normalizeSelectorArray(input?.removeSelectors, 20);

  const rawMinLen = Number(input?.minLength);
  const minLength = Number.isFinite(rawMinLen)
    ? Math.min(300, Math.max(20, Math.round(rawMinLen)))
    : 40;

  const rawConfidence = Number(input?.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0.5;

  if (contentSelectors.length === 0) return null;
  return { contentSelectors, removeSelectors, minLength, confidence, source: 'ai', sampleUrl: '', updatedAt: '' };
}

function normalizeListingConfig(input) {
  const linkSelectors = normalizeSelectorArray(input?.linkSelectors, 10)
    .filter((s) => !isListingSelectorTooGeneric(s));
  const removeSelectors = normalizeSelectorArray(input?.removeSelectors, 20);

  const rawConfidence = Number(input?.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0.5;

  if (linkSelectors.length === 0) return null;
  return { linkSelectors, removeSelectors, confidence, source: 'ai', sampleUrl: '', updatedAt: '' };
}

function extractJson(raw) {
  const text = raw.trim();
  try { return JSON.parse(text); } catch {}
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1].trim()); } catch {}
  }
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return JSON.parse(braceMatch[0]);
  throw new Error('Cannot extract JSON from AI response');
}

function isLikelyArticlePage(pageUrl, html) {
  try {
    const u = new URL(pageUrl);
    const path = u.pathname.toLowerCase().replace(/\/+$/, '');
    const segments = path.split('/').filter(Boolean);

    if (segments.length < 2) return false;
    if (/(^|\/)(category|categories|tag|tags|author|authors|topics|topic)(\/|$)/.test(path)) return false;
    if (/\/page\/\d+\/?$/.test(path)) return false;
    if (/(^|\/)(docs|documentation|help|faq|about|careers|privacy|terms|contact|search|pricing|changelog)(\/|$)/.test(path)) return false;

    const compact = html.replace(/\s+/g, ' ').slice(0, 200000).toLowerCase();
    if (compact.includes('"@type":"blogposting"') || compact.includes('"@type": "blogposting"')) return true;
    if (compact.includes('"@type":"newsarticle"') || compact.includes('"@type": "newsarticle"')) return true;
    if (/property=["']og:type["'][^>]*content=["']article["']/i.test(compact) ||
        /content=["']article["'][^>]*property=["']og:type["']/i.test(compact)) return true;
    if (/<article[^>]*>[\s\S]{200,}<\/article>/i.test(html)) return true;

    return false;
  } catch {
    return false;
  }
}

function isLikelyNoisyContent(text) {
  if (!text) return true;
  const lower = text.toLowerCase();
  const noiseMarkers = ['cookie', 'privacy policy', 'subscribe', 'advertisement', 'all rights reserved', 'sign in', 'log in', 'newsletter'];
  let hits = 0;
  for (const marker of noiseMarkers) {
    if (lower.includes(marker)) hits++;
  }
  return hits >= 4;
}

// ─── Test Suites ─────────────────────────────────────────────────────────────

console.log('\n📋 normalizeConfig (article profile)');
{
  // Loại bỏ selector generic
  const r1 = normalizeConfig({ contentSelectors: ['html', 'body', '.article-body'], removeSelectors: [], minLength: 40, confidence: 0.9 });
  assert('Loại bỏ "html" và "body" khỏi contentSelectors', r1?.contentSelectors.length === 1 && r1.contentSelectors[0] === '.article-body');

  // Clamp minLength
  const r2 = normalizeConfig({ contentSelectors: ['.content'], minLength: 500, confidence: 0.5 });
  assert('Clamp minLength về max 300 khi AI trả 500', r2?.minLength === 300);
  const r3 = normalizeConfig({ contentSelectors: ['.content'], minLength: 5, confidence: 0.5 });
  assert('Clamp minLength về min 20 khi AI trả 5', r3?.minLength === 20);

  // Clamp confidence
  const r4 = normalizeConfig({ contentSelectors: ['.content'], confidence: 1.5 });
  assert('Clamp confidence về max 1.0', r4?.confidence === 1);
  const r5 = normalizeConfig({ contentSelectors: ['.content'], confidence: -0.3 });
  assert('Clamp confidence về min 0', r5?.confidence === 0);

  // Trả null khi không có selector hợp lệ
  const r6 = normalizeConfig({ contentSelectors: ['html', 'body', '*'], confidence: 0.9 });
  assert('Trả null khi tất cả selector đều generic', r6 === null);

  // Deduplicate selectors
  const r7 = normalizeConfig({ contentSelectors: ['.content', '.content', '.article'], confidence: 0.8 });
  assert('Deduplicate selectors trùng nhau', r7?.contentSelectors.length === 2);

  // Loại selector quá dài (>180 chars)
  const longSel = '.a'.padEnd(200, '-b');
  const r8 = normalizeConfig({ contentSelectors: [longSel, '.short-sel'], confidence: 0.8 });
  assert('Loại bỏ selector dài hơn 180 ký tự', r8?.contentSelectors.length === 1 && r8.contentSelectors[0] === '.short-sel');

  // Input không phải array
  const r9 = normalizeConfig({ contentSelectors: '.article-body', confidence: 0.8 });
  assert('Trả null khi contentSelectors không phải array', r9 === null);
}

console.log('\n📋 normalizeListingConfig');
{
  // Loại selector generic
  const r1 = normalizeListingConfig({ linkSelectors: ['a', 'body a', '.post-link a'], confidence: 0.8 });
  assert('Loại bỏ "a" và "body a" khỏi linkSelectors', r1?.linkSelectors.length === 1 && r1.linkSelectors[0] === '.post-link a');

  const r2 = normalizeListingConfig({ linkSelectors: ['a', '*', 'html a'], confidence: 0.5 });
  assert('Trả null khi tất cả link selector đều generic', r2 === null);

  const r3 = normalizeListingConfig({ linkSelectors: ['.card-link', '.post-item a'], confidence: 1.8 });
  assert('Clamp confidence listing về max 1.0', r3?.confidence === 1);
}

console.log('\n📋 extractJson');
{
  // JSON thuần
  assert('Parse bare JSON', extractJson('{"foo":"bar"}')?.foo === 'bar');

  // Markdown code fence
  const md = '```json\n{"key":"value"}\n```';
  assert('Parse JSON trong markdown code fence', extractJson(md)?.key === 'value');

  // Markdown không có label
  const md2 = '```\n{"x":42}\n```';
  assert('Parse JSON trong fence không nhãn', extractJson(md2)?.x === 42);

  // JSON nằm kèm trong text
  const mixed = 'Here is the result: {"a":1} hope that helps';
  assert('Extract JSON từ giữa text', extractJson(mixed)?.a === 1);

  // Lỗi khi không có JSON
  let threw = false;
  try { extractJson('no json here'); } catch { threw = true; }
  assert('Ném lỗi khi không có JSON', threw);
}

console.log('\n📋 isLikelyArticlePage');
{
  // Tín hiệu Schema.org BlogPosting
  const blogJson = `<html><body><script type="application/ld+json">{"@type":"BlogPosting","headline":"Test"}</script><p>content</p></body></html>`;
  assert('Nhận diện BlogPosting schema.org', isLikelyArticlePage('https://example.com/blog/my-post-title', blogJson));

  // Tín hiệu Schema.org NewsArticle
  const newsJson = `<html><body><script type="application/ld+json">{"@type": "NewsArticle"}</script></body></html>`;
  assert('Nhận diện NewsArticle schema.org', isLikelyArticlePage('https://news.example.com/tech/article-slug', newsJson));

  // OG article type
  const ogHtml = `<html><head><meta property="og:type" content="article"/></head><body></body></html>`;
  assert('Nhận diện og:type=article', isLikelyArticlePage('https://example.com/2024/01/my-article', ogHtml));

  // <article> tag với đủ nội dung
  const articleTag = `<html><body><article class="post"><p>${'Lorem ipsum '.repeat(30)}</p></article></body></html>`;
  assert('Nhận diện <article> tag với nội dung đủ dài', isLikelyArticlePage('https://example.com/posts/some-slug', articleTag));

  // Từ chối homepage (depth < 2)
  assert('Từ chối homepage /', !isLikelyArticlePage('https://example.com/', '<html><body></body></html>'));
  assert('Từ chối /blog (depth 1)', !isLikelyArticlePage('https://example.com/blog', '<html><body></body></html>'));

  // Từ chối tag/category page
  assert('Từ chối /tag/javascript', !isLikelyArticlePage('https://example.com/tag/javascript', '<html><body></body></html>'));
  assert('Từ chối /category/tech', !isLikelyArticlePage('https://example.com/category/tech', '<html><body></body></html>'));

  // Từ chối pagination
  assert('Từ chối /blog/page/2', !isLikelyArticlePage('https://example.com/blog/page/2', '<html><body></body></html>'));

  // Không có tín hiệu mạnh → false (không còn catch-all true)
  const noSignal = '<html><body><p>Some content</p></body></html>';
  assert('Trả false khi không có tín hiệu (không catch-all)', !isLikelyArticlePage('https://example.com/product/some-item', noSignal));

  // <article> quá ngắn (<200 chars) → false
  const shortArticle = '<html><body><article><p>Short.</p></article></body></html>';
  assert('Từ chối <article> nội dung quá ngắn (<200 chars)', !isLikelyArticlePage('https://example.com/posts/short', shortArticle));
}

console.log('\n📋 isLikelyNoisyContent');
{
  const noisy = 'We use cookies. Privacy policy. Subscribe to our newsletter. Advertisement. All rights reserved. Sign in. Log in.';
  assert('Phát hiện nội dung noise với 4+ markers', isLikelyNoisyContent(noisy));

  const clean = 'Anthropic released a new version of Claude with improved reasoning capabilities.';
  assert('Không nhầm nội dung clean là noise', !isLikelyNoisyContent(clean));

  assert('Text rỗng coi là noise', isLikelyNoisyContent(''));
  assert('null coi là noise', isLikelyNoisyContent(null));
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
const total = passed + failed;
console.log(`Kết quả: ${passed}/${total} tests passed ${failed > 0 ? `(${failed} failed)` : '✅'}`);
if (failed > 0) process.exit(1);
