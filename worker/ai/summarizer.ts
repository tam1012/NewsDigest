import { Env } from '../types';
import { ProhibitedContentError } from '../errors';
import { buildPromptConfig, PromptConfig } from './prompt-config';
import { callGemini as callGeminiApi, extractJson } from './gemini';
import {
  buildSystemPrompt,
  buildDigestPrompt,
  buildFallbackStep1System, buildFallbackStep1User,
  buildFallbackStep2System, buildFallbackStep2User,
  FALLBACK_STEP3_SYSTEM, buildFallbackStep3User,
  buildFallbackStep4System, buildFallbackStep4User,
} from './prompts';

export { ProhibitedContentError };

export interface SummaryResult {
  description_vn: string;
  summary: string;
  hot_score: number;
  tags: string[];
}

export interface DigestResult {
  digest_text: string;
}


// ── Model Pool ────────────────────────────────────────────────────────────
// Hai model Gemma 4 cùng rate limit (RPM=15, TPM=Unlimited, RPD=1500).
// Random chọn model → gấp đôi throughput (RPM=30, RPD=3000).
// Khi bị 429 → tự chuyển sang model kia.
const MODELS = ['gemma-4-31b-it', 'gemma-4-26b-a4b-it'] as const;
const MAX_RETRIES = 3;

function pickModel(): string {
  return MODELS[Math.floor(Math.random() * MODELS.length)];
}

function getOtherModel(current: string): string {
  return current === MODELS[0] ? MODELS[1] : MODELS[0];
}

// ── AI API Call (JSON mode) ────────────────────────────────────────────────
async function callGemini(
  env: Env,
  systemPrompt: string,
  userPrompt: string,
  model = pickModel(),
  attempt = 1,
  timeoutMs?: number,
): Promise<string> {
  return callGeminiApi({
    systemPrompt,
    userPrompt,
    model,
    getOtherModel,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
    timeoutMs,
    attempt,
    maxRetries: MAX_RETRIES,
    retryOnStatuses: [429],
    retryBackoffMsBase: 2000,
  }, env);
}

// ── AI API Call (Plain Text mode — no responseMimeType) ────────────────────
// Dùng cho multi-step fallback khi JSON mode thất bại
async function callGeminiPlainText(
  env: Env,
  systemPrompt: string,
  userPrompt: string,
  model: string = pickModel(),
  timeoutMs = 60000,
  attempt = 1,
): Promise<string> {
  const text = await callGeminiApi({
    systemPrompt,
    userPrompt,
    model,
    getOtherModel,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
    timeoutMs,
    attempt,
    maxRetries: MAX_RETRIES,
    retryOnStatuses: [429],
    retryBackoffMsBase: 2000,
  }, env);
  return text.trim();
}

// ── Clean fallback response ───────────────────────────────────────────────
// Model sometimes echoes back instructions or adds meta-commentary.
// Strip known patterns to get clean content only.
function cleanFallbackResponse(raw: string): string {
  let text = raw.trim();

  // Remove lines that echo back task/constraint instructions
  const echoPatterns = [
    /^\*?\s*Task:.*$/gm,
    /^\*?\s*Constraint:.*$/gm,
    /^\*?\s*Input:.*$/gm,
    /^\*?\s*Output:.*$/gm,
    /^Here is the .*:?\s*$/gim,
    /^Here's the .*:?\s*$/gim,
    /^Below is .*:?\s*$/gim,
    /^Dưới đây là .*:?\s*$/gim,
    /^Đây là .*:?\s*$/gim,
  ];
  for (const pattern of echoPatterns) {
    text = text.replace(pattern, '');
  }

  // Collapse multiple blank lines
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

// ── callGeminiWithJsonRetry ────────────────────────────────────────────────
// Gọi AI, parse JSON, nếu lỗi thì retry với model khác (tối đa MAX_RETRIES lần)
async function callGeminiWithJsonRetry<T>(
  env: Env,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs?: number,
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Alternate models on each attempt for better distribution
    const model = attempt === 1 ? pickModel() : getOtherModel(MODELS[attempt % 2]);
    try {
      console.log(`🤖 Attempt ${attempt}/${MAX_RETRIES} using ${model}`);
      const raw = await callGemini(env, systemPrompt, userPrompt, model, 1, timeoutMs);
      const result = extractJson<T>(raw, { repair: true });
      if (attempt > 1) console.log(`✅ JSON valid on attempt ${attempt}`);
      return result;
    } catch (err: any) {
      // Content blocked by safety filters → no point retrying
      if (err instanceof ProhibitedContentError) throw err;
      lastError = err;
      console.log(`⚠️ Attempt ${attempt}/${MAX_RETRIES} [${model}] failed: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * attempt)); // 1s, 2s
      }
    }
  }

  throw lastError ?? new Error(`AI call failed after ${MAX_RETRIES} retries`);
}

// ── Validate SummaryResult ─────────────────────────────────────────────────
function validateSummary(result: any): result is SummaryResult {
  return (
    typeof result?.description_vn === 'string' && result.description_vn.length > 0 &&
    typeof result?.summary === 'string' && result.summary.length > 0 &&
    typeof result?.hot_score === 'number' &&
    Array.isArray(result?.tags)
  );
}

// ── Multi-Step Fallback (plain text, no JSON) ─────────────────────────────
// When JSON mode fails → 4 separate calls, one per field.

async function summarizeArticleFallback(
  title: string,
  truncatedContent: string,
  env: Env,
  config: PromptConfig,
): Promise<SummaryResult> {
  const model = pickModel();
  const lang = config.outputLanguage;
  console.log(`🔄 Fallback: using ${model} multi-step for "${title.slice(0, 60)}"`);

  // Step 1: short overview
  const description_vn = cleanFallbackResponse(await callGeminiPlainText(
    env,
    buildFallbackStep1System(lang),
    buildFallbackStep1User(lang, title, truncatedContent),
  ));
  console.log(`  ✅ Step 1/4 description_vn (${description_vn.length} chars)`);

  // Step 2: full markdown summary
  const summary = cleanFallbackResponse(await callGeminiPlainText(
    env,
    buildFallbackStep2System(lang),
    buildFallbackStep2User(lang, title, truncatedContent),
  ));
  console.log(`  ✅ Step 2/4 summary (${summary.length} chars)`);

  // Step 3: hot_score
  const scoreRaw = await callGeminiPlainText(
    env,
    FALLBACK_STEP3_SYSTEM,
    buildFallbackStep3User(title, description_vn),
  );
  const scoreMatch = scoreRaw.match(/\d+/);
  const hot_score = Math.max(1, Math.min(10, scoreMatch ? parseInt(scoreMatch[0], 10) : 5));
  console.log(`  ✅ Step 3/4 hot_score = ${hot_score} (raw: "${scoreRaw.slice(0, 30)}")`);

  // Step 4: tags
  const tagsRaw = await callGeminiPlainText(
    env,
    buildFallbackStep4System(config.allowedTags),
    buildFallbackStep4User(title, description_vn),
  );
  const tags = tagsRaw
    .split(',')
    .map((t) => t.trim().replace(/[^a-zA-Z]/g, ''))
    .filter((t) => config.allowedTags.includes(t))
    .slice(0, 3);
  console.log(`  ✅ Step 4/4 tags = [${tags.join(', ')}]`);

  console.log(`✅ Fallback complete for "${title.slice(0, 60)}"`);
  return { description_vn, summary, hot_score, tags };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Tóm tắt + score + tag cho 1 bài viết.
 * Thử JSON mode (retry) trước → nếu fail → multi-step plain text (last resort).
 */
export async function summarizeArticle(
  title: string,
  content: string,
  env: Env,
): Promise<SummaryResult | null> {
  const config = buildPromptConfig(env);
  const systemPrompt = buildSystemPrompt(config);

  const truncated = content.length > 15000 ? content.slice(0, 15000) + '...' : content;
  const userPrompt = `Title: ${title}\n\nContent:\n${truncated}`;

  // ── Try JSON mode (with retry) ──
  try {
    const result = await callGeminiWithJsonRetry<SummaryResult>(env, systemPrompt, userPrompt);

    if (!validateSummary(result)) {
      console.log(`⚠️ Invalid AI structure for "${title}": ${JSON.stringify(result).slice(0, 100)}`);
      throw new Error('Invalid model response structure');
    }

    result.hot_score = Math.max(1, Math.min(10, Math.round(result.hot_score)));
    result.tags = result.tags.slice(0, 3).map(String);
    return result;
  } catch (primaryErr: any) {
    // Content permanently blocked — don't waste API calls on fallback
    if (primaryErr instanceof ProhibitedContentError) throw primaryErr;
    console.log(`⚠️ JSON mode failed for "${title}": ${primaryErr.message}`);
    console.log(`🔄 Switching to multi-step plain text fallback...`);
  }

  // ── Last resort: multi-step plain text ──
  try {
    return await summarizeArticleFallback(title, truncated, env, config);
  } catch (fallbackErr: any) {
    // Content permanently blocked — propagate immediately, no more retries
    if (fallbackErr instanceof ProhibitedContentError) throw fallbackErr;
    console.error(`❌ All strategies failed for "${title}": ${fallbackErr.message}`);
    throw fallbackErr;
  }
}

/**
 * Tổng hợp digest từ danh sách bài đã summarized.
 * AI nhận short ID (8 chars) để giảm token noise → sau khi generate xong,
 * expand lại thành full UUID trước khi trả về.
 * Flow: JSON mode (retry) → plain text (last resort).
 */
export async function generateDigest(
  articles: { id: string; title: string; summary: string; hot_score: number }[],
  env: Env,
): Promise<DigestResult | null> {
  if (articles.length === 0) return null;

  const config = buildPromptConfig(env);
  const digestPrompt = buildDigestPrompt(config);

  // ── Build short ID ↔ full UUID mapping ──
  // UUID first 8 chars (before first hyphen) — collision-free for ~50 articles
  const shortToFull = new Map<string, string>();
  for (const a of articles) {
    const shortId = a.id.slice(0, 8);
    shortToFull.set(shortId, a.id);
  }

  const formatted = articles
    .map((a) => `ID: ${a.id.slice(0, 8)}\nTitle: ${a.title}\nSummary: ${a.summary}\nScore: ${a.hot_score}`)
    .join('\n---\n');
  const userPrompt = `Analyze and synthesize ${articles.length} articles from today:\n\n${formatted}`;

  const DIGEST_TIMEOUT = 120000; // 120s — digest prompt is large (40+ articles)

  /** Expand short IDs back to full UUIDs + strip any hallucinated IDs */
  function expandIds(text: string): string {
    return text.replace(/<id:([a-f0-9-]+)>/gi, (_match, fragment: string) => {
      // Exact short ID match (expected case)
      const fullId = shortToFull.get(fragment);
      if (fullId) return `<id:${fullId}>`;
      // Prefix match fallback (LLM sometimes adds extra chars)
      for (const [short, full] of shortToFull) {
        if (fragment.startsWith(short) || short.startsWith(fragment)) {
          return `<id:${full}>`;
        }
      }
      // No match → strip hallucinated ID
      console.log(`⚠️ Digest: stripping unknown ID fragment "${fragment}"`);
      return '';
    });
  }

  // ── Try JSON mode (with retry) ──
  try {
    const result = await callGeminiWithJsonRetry<DigestResult>(env, digestPrompt, userPrompt, DIGEST_TIMEOUT);
    if (result.digest_text) {
      result.digest_text = expandIds(result.digest_text);
      return result;
    }
    console.log('⚠️ Invalid digest structure');
  } catch (err: any) {
    console.log(`⚠️ JSON mode digest failed: ${err.message}`);
  }

  // ── Last resort: plain text (digest only needs 1 field) ──
  try {
    console.log(`🔄 Trying plain text mode for digest...`);
    const rawText = cleanFallbackResponse(await callGeminiPlainText(
      env,
      digestPrompt,
      userPrompt,
      undefined,
      DIGEST_TIMEOUT,
    ));

    // Model may return JSON even in plain text mode → try to extract digest_text
    let digestText = rawText;
    try {
      const parsed = extractJson<DigestResult>(rawText);
      if (parsed.digest_text) digestText = parsed.digest_text;
    } catch {
      // Not JSON → use raw text as-is
    }

    if (digestText && digestText.length > 50) {
      digestText = expandIds(digestText);
      console.log(`✅ Plain text digest succeeded (${digestText.length} chars)`);
      return { digest_text: digestText };
    }
    console.log('⚠️ Plain text digest too short');
    return null;
  } catch (fallbackErr: any) {
    console.error(`❌ All digest strategies failed: ${fallbackErr.message}`);
    throw fallbackErr;
  }
}
