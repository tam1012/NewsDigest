import { Env, ListingProfileConfig, ScraperProfileConfig } from '../types';
import { callGemini as callGeminiApi, extractJson as extractJsonValue } from './gemini';

// Hai model Gemma 4 cùng rate limit → gấp đôi throughput
const MODELS = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'] as const;
const MAX_RETRIES = 3;

function pickModel(): string {
  return MODELS[Math.floor(Math.random() * MODELS.length)];
}

function getOtherModel(current: string): string {
  return current === MODELS[0] ? MODELS[1] : MODELS[0];
}

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



export function extractJson<T>(raw: string): T {
  return extractJsonValue<T>(raw, { errorPrefix: 'Cannot extract JSON from AI response' });
}

export async function callGemini(
  env: Env,
  systemPrompt: string,
  prompt: string,
  model = pickModel(),
  attempt = 1
): Promise<string> {
  return callGeminiApi({
    systemPrompt,
    userPrompt: prompt,
    model,
    getOtherModel,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
    attempt,
    maxRetries: MAX_RETRIES,
    retryOnStatuses: [429, 503],
    retryOnTimeout: true,
    retryBackoffMsBase: 1000,
  }, env);
}

function isContentSelectorTooGeneric(selector: string): boolean {
  const s = selector.trim().toLowerCase();
  return s === 'html' || s === 'body' || s === '*' || s === 'main' || s === '[role="main"]';
}

function normalizeSelectorArray(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
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

export function normalizeConfig(input: any): ScraperProfileConfig | null {
  const contentSelectors = normalizeSelectorArray(input?.contentSelectors, 8)
    .filter((s) => !isContentSelectorTooGeneric(s));
  const removeSelectors = normalizeSelectorArray(input?.removeSelectors, 20);

  const rawMinLen = Number(input?.minLength);
  const minLength = Number.isFinite(rawMinLen) ? Math.min(300, Math.max(20, Math.round(rawMinLen))) : 40;

  const rawConfidence = Number(input?.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0.5;

  if (contentSelectors.length === 0) return null;

  return {
    contentSelectors,
    removeSelectors,
    minLength,
    confidence,
    source: 'ai',
    sampleUrl: '',
    updatedAt: new Date().toISOString(),
  };
}

function isListingSelectorTooGeneric(selector: string): boolean {
  const s = selector.trim().toLowerCase();
  return s === 'a' || s === 'body a' || s === 'html a' || s === '*';
}

export function normalizeListingConfig(input: any): ListingProfileConfig | null {
  const linkSelectors = normalizeSelectorArray(input?.linkSelectors, 10)
    .filter((s) => !isListingSelectorTooGeneric(s));
  const removeSelectors = normalizeSelectorArray(input?.removeSelectors, 20);

  const rawConfidence = Number(input?.confidence);
  const confidence = Number.isFinite(rawConfidence)
    ? Math.min(1, Math.max(0, rawConfidence))
    : 0.5;

  if (linkSelectors.length === 0) return null;

  return {
    linkSelectors,
    removeSelectors,
    confidence,
    source: 'ai',
    sampleUrl: '',
    updatedAt: new Date().toISOString(),
  };
}

export async function generateScraperProfile(
  domain: string,
  sampleUrl: string,
  cleanedHtml: string,
  env: Env
): Promise<ScraperProfileConfig | null> {
  if (!cleanedHtml || cleanedHtml.length < 300) return null;

  const prompt = [
    `Domain: ${domain}`,
    `Sample URL: ${sampleUrl}`,
    'Task: infer robust selectors for article content extraction.',
    'HTML sample:',
    cleanedHtml.slice(0, 120000),
  ].join('\n\n');

  try {
    const raw = await callGemini(env, ARTICLE_SYSTEM_PROMPT, prompt);
    const parsed = extractJson<any>(raw);
    const config = normalizeConfig(parsed);
    if (!config) {
      console.log(`[scraper] normalizeConfig failed for ${domain}`);
      return null;
    }
    config.sampleUrl = sampleUrl;
    return config;
  } catch (err: any) {
    console.log(`[scraper] AI error for ${domain}: ${err.message}`);
    return null;
  }
}

export async function generateListingProfile(
  domain: string,
  sampleUrl: string,
  cleanedHtml: string,
  env: Env
): Promise<ListingProfileConfig | null> {
  if (!cleanedHtml || cleanedHtml.length < 300) return null;

  const prompt = [
    `Domain: ${domain}`,
    `Sample URL: ${sampleUrl}`,
    'Task: infer robust selectors for extracting article links from a listing page.',
    'HTML sample:',
    cleanedHtml.slice(0, 120000),
  ].join('\n\n');

  try {
    const raw = await callGemini(env, LISTING_SYSTEM_PROMPT, prompt);
    const parsed = extractJson<any>(raw);
    const config = normalizeListingConfig(parsed);
    if (!config) {
      console.log(`[scraper] listing normalizeConfig failed for ${domain}`);
      return null;
    }
    config.sampleUrl = sampleUrl;
    return config;
  } catch (err: any) {
    console.log(`[scraper] listing AI error for ${domain}: ${err.message}`);
    return null;
  }
}
