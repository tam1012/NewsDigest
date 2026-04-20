import { Env } from '../types';
import { ProhibitedContentError } from '../errors';
import { buildPromptConfig, PromptConfig } from './prompt-config';
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

// ── JSON Auto-Repair & Extraction ─────────────────────────────────────────
// Thứ tự ưu tiên:
// 1. Parse thẳng (ideal case)
// 2. Tách khỏi markdown code block (```json ... ```)
// 3. Tìm { ... } đầu tiên bằng regex
// 4. Throw nếu không cứu được
function extractJson<T>(raw: string): T {
  const text = raw.trim();

  // 1. Raw parse
  try { return JSON.parse(text); } catch {}

  // 2. Markdown code block
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (blockMatch) {
    try { return JSON.parse(blockMatch[1].trim()); } catch {}
  }

  // 3. Extract first {...} (handles garbage prefix/suffix)
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try { return JSON.parse(braceMatch[0]); } catch (e: any) {
      // 4. Try to repair common issues: truncated JSON → incomplete string/array
      const repaired = braceMatch[0]
        .replace(/,\s*$/, '')     // trailing comma
        .replace(/([^\\])"$/, '$1"}')  // unclosed string
        + (braceMatch[0].split('{').length > braceMatch[0].split('}').length ? '}' : '');
      try { return JSON.parse(repaired); } catch {}
    }
  }

  throw new Error(`Cannot extract valid JSON from: ${text.slice(0, 150)}`);
}

// ── Extract response text (skip thinking parts) ──────────────────────────
// Gemma models return multi-part responses where parts with `thought: true`
// are internal reasoning. We need the actual answer part.
function extractResponseText(data: any): string | null {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;

  // Find the last non-thinking part (the actual answer)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (!parts[i].thought && parts[i].text) {
      return parts[i].text;
    }
  }

  // Fallback: return first part with text (even if thinking)
  return parts[0]?.text ?? null;
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
  const url = `${env.AI_GATEWAY_URL}/v1beta/models/${model}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
      responseMimeType: 'application/json',
    },
  };

  const timeout = timeoutMs ?? 60000;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
      'cf-aig-byok-alias': 'default',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });

  // Rate-limited → switch to the other model and retry
  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new Error(`${model} rate limit (429) after max retries`);
    const nextModel = getOtherModel(model);
    const wait = attempt * 2000; // 2s, 4s, 6s — short wait since other model is likely not rate-limited
    console.log(`⏳ ${model} 429 — switching to ${nextModel}, waiting ${wait / 1000}s (retry ${attempt + 1}/${MAX_RETRIES})`);
    await new Promise(r => setTimeout(r, wait));
    return callGemini(env, systemPrompt, userPrompt, nextModel, attempt + 1, timeoutMs);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`AI API error [${model}] ${res.status}: ${err.slice(0, 200)}`);
  }

  const data: any = await res.json();

  // Detect content blocked by safety filters — no point retrying
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new ProhibitedContentError(blockReason);
  }

  const text = extractResponseText(data);
  if (!text) throw new Error('Empty AI response');
  return text;
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
  const url = `${env.AI_GATEWAY_URL}/v1beta/models/${model}:generateContent`;

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 2048,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
      'cf-aig-byok-alias': 'default',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });

  // Rate-limited → switch to the other model and retry (same as callGemini)
  if (res.status === 429) {
    if (attempt >= MAX_RETRIES) throw new Error(`${model} rate limit (429) after max retries`);
    const nextModel = getOtherModel(model);
    const wait = attempt * 2000;
    console.log(`⏳ [plaintext] ${model} 429 — switching to ${nextModel}, waiting ${wait / 1000}s (retry ${attempt + 1}/${MAX_RETRIES})`);
    await new Promise(r => setTimeout(r, wait));
    return callGeminiPlainText(env, systemPrompt, userPrompt, nextModel, timeoutMs, attempt + 1);
  }

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`AI API error [${model}] ${res.status}: ${err.slice(0, 200)}`);
  }

  const data: any = await res.json();

  // Detect content blocked by safety filters — no point retrying
  const blockReason = data?.promptFeedback?.blockReason;
  if (blockReason) {
    throw new ProhibitedContentError(blockReason);
  }

  const text = extractResponseText(data);
  if (!text) throw new Error(`Empty ${model} response`);
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
      const result = extractJson<T>(raw);
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
 * AI sẽ inline reference bằng <id:uuid> trong digest_text.
 * Flow: JSON mode (retry) → plain text (last resort).
 */
export async function generateDigest(
  articles: { id: string; title: string; summary: string; hot_score: number }[],
  env: Env,
): Promise<DigestResult | null> {
  if (articles.length === 0) return null;

  const config = buildPromptConfig(env);
  const digestPrompt = buildDigestPrompt(config);

  const formatted = articles
    .map((a) => `ID: ${a.id}\nTitle: ${a.title}\nSummary: ${a.summary}\nScore: ${a.hot_score}`)
    .join('\n---\n');
  const userPrompt = `Analyze and synthesize ${articles.length} articles from today:\n\n${formatted}`;

  const DIGEST_TIMEOUT = 120000; // 120s — digest prompt is large (40+ articles)

  // ── Try JSON mode (with retry) ──
  try {
    const result = await callGeminiWithJsonRetry<DigestResult>(env, digestPrompt, userPrompt, DIGEST_TIMEOUT);
    if (result.digest_text) return result;
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
