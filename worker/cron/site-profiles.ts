/**
 * Site-specific extraction profiles.
 * Mỗi profile định nghĩa:
 * - contentSelectors: thử lần lượt, dùng cái đầu tiên có kết quả
 * - removeSelectors: xoá noise trước khi extract
 * - minLength: bỏ đoạn text quá ngắn (menu, button...)
 */

export interface SiteProfile {
  contentSelectors: string[];
  removeSelectors: string[];
  minLength?: number;
}

export const SITE_PROFILES: Record<string, SiteProfile> = {

  // ─── CNET ────────────────────────────────────────────────────────────────
  'cnet.com': {
    contentSelectors: [
      '.c-pageArticle_body article.c-ShortcodeContent',
      '.c-pageArticle_body',
      '.c-pageArticle_content',
    ],
    removeSelectors: [
      '[data-ad-callout]', '[data-ad]',
      '.c-adDisplay', '.c-adDisplay_container',
      '.c-pageArticle_rightRail', '.c-articleRightRail', '.c-articleRightRailAds',
      '.c-articleLinkBlock', '.c-bestListLinkBlock',
      '.c-avStickyVideo', '.c-CnetAvStickyVideo',
      '.c-socialShareButton',
      '.c-globalAuthorCard', '.c-authorCard',
      '.c-topicBreadcrumbs',
      'script', 'style', 'noscript', 'iframe',
      'nav', 'header', 'footer',
    ],
    minLength: 40,
  },

  // ─── THE VERGE ────────────────────────────────────────────────────────────
  'theverge.com': {
    contentSelectors: [
      '.duet--article--article-body-component',
      'article .body-text',
      '[data-chorus-optimize-field="body"]',
    ],
    removeSelectors: [
      'aside', '.c-float-aside', '.ad', '[data-component="Ad"]',
      '.duet--article--article-sidebar', 'figure.e-image--hero',
      'script', 'style', 'noscript', 'nav', 'header', 'footer',
      '.comments', '#comments', '.c-comments',
    ],
    minLength: 40,
  },

  // ─── VNEXPRESS ────────────────────────────────────────────────────────────
  'vnexpress.net': {
    contentSelectors: [
      '.fck_detail',
      'article.content_detail .fck_detail',
    ],
    removeSelectors: [
      '.box-tinlienquan', '.related-news', '.box_brief_info',
      '.ad', '.ads', '#bnc-cpe-publisher',
      'script', 'style', 'noscript',
    ],
    minLength: 30,
  },

  // ─── TUOI TRE ─────────────────────────────────────────────────────────────
  'tuoitre.vn': {
    contentSelectors: [
      '.detail-cmain',
      '#main-detail-body',
    ],
    removeSelectors: [
      '.ads', '.box-category-middle', '.relate-zone',
      '.author', '.social-share',
      'script', 'style', 'noscript',
    ],
    minLength: 30,
  },

  // ─── DEFAULT (fallback cho trang không có profile) ─────────────────────
  '_default': {
    contentSelectors: [
      'article',
      '[role="main"]',
      'main',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.article-body',
      '.content-body',
      '#article-body',
    ],
    removeSelectors: [
      'script', 'style', 'noscript', 'iframe',
      'nav', 'header', 'footer', 'aside',
      '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
      '.ad', '.ads', '.advertisement', '.sidebar',
      '.menu', '.nav', '.cookie', '.popup', '.modal',
      '.share', '.social', '.comments', '.related', '.recommended',
    ],
    minLength: 40,
  },
};

export function getProfile(url: string): SiteProfile & { hostname: string } {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const key = Object.keys(SITE_PROFILES).find(k => hostname === k || hostname.endsWith('.' + k));
    const profile = key ? SITE_PROFILES[key] : SITE_PROFILES['_default'];
    return { ...profile, hostname };
  } catch {
    return { ...SITE_PROFILES['_default'], hostname: 'unknown' };
  }
}
