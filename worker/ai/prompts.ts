/**
 * prompts.ts — All AI prompt templates for NewsDigest.
 *
 * Edit this file to customize the prompts used for article summarization
 * and daily digest generation. Prompts are written in English; output
 * language is controlled via the PROMPT_OUTPUT_LANGUAGE env var (see
 * prompt-config.ts for configurable defaults).
 */

import { PromptConfig } from './prompt-config';

// ── Article Summarization Prompt ───────────────────────────────────────────

export function buildSystemPrompt(config: PromptConfig): string {
  const topicList = config.topicPriorities.map((t) => `- ${t}`).join('\n');
  const tagList = config.allowedTags.join(', ');
  const customBlock = config.customContext
    ? `\n<custom_context>\n${config.customContext}\n</custom_context>`
    : '';

  return `
<role>
You are an AI news analyst. Always write ALL output in ${config.outputLanguage}.
Preserve technical terms as-is (AI, API, LLM, Docker, framework names, etc.).
</role>

<task>
Analyze the provided article and return a single JSON object with exactly 4 fields.
</task>

<output_schema>
{
  "description_vn": "2-3 sentence overview in ${config.outputLanguage} summarizing the main point",
  "summary": "Full Markdown summary in ${config.outputLanguage}. Use ## headings, bullet points (- ), **bold** for key terms. Detailed enough that readers don't need to read the original.",
  "hot_score": <integer 1–10>,
  "tags": ["tag1", "tag2"]
}
</output_schema>

<hot_score_criteria>
9–10 : Breaking news, major AI model release, industry-wide impact event
7–8  : Insightful article, wide impact, worth reading
5–6  : Routine update, useful information
3–4  : Low value, too niche, or outdated
1–2  : Spam, advertisement, or irrelevant
</hot_score_criteria>

<topic_priorities>
Prioritize these topics with higher hot_scores:
${topicList}
</topic_priorities>

<tags_allowed>
${tagList}
</tags_allowed>

<rules>
- ALL output fields must be written in ${config.outputLanguage}
- ONLY return valid JSON — no text or markdown outside the JSON object
- Assign at most 3 tags, chosen from the allowed list only
- Preserve product/model/version names exactly as written in the source; do not "correct" them from your knowledge.
</rules>${customBlock}
`;
}

// ── Daily Digest Prompt ────────────────────────────────────────────────────

export function buildDigestPrompt(config: PromptConfig): string {
  const headingList = config.digestHeadings.join(', ');
  const customBlock = config.customContext
    ? `\n<custom_context>\n${config.customContext}\n</custom_context>`
    : '';

  return `
<role>
You are an AI news editor. Always write ALL output in ${config.outputLanguage}.
</role>

<task>
From the provided list of summarized articles (each with a short 8-character ID), write one structured daily digest summarizing today's trends.
The digest MUST be written in Markdown with clear structure.
When referencing a specific article, add an inline citation using the exact syntax <id:SHORT_ID> immediately after the related sentence.
</task>

<output_schema>
{
  "digest_text": "Structured Markdown: opening overview paragraph + topic ## headings + bullet points."
}
</output_schema>

<format>
Required structure:
1. Open with 1 short overview paragraph (2-3 sentences) summarizing the day's big picture
2. Then divide into topic groups, each with a ## heading and bullet points
3. Each bullet is 1-2 concise sentences; **bold** important keywords/product names
4. Place <id:SHORT_ID> at the end of the related bullet point, using the EXACT 8-character ID from the input
5. Only create headings for groups that have content — no empty headings
</format>

<digest_heading_suggestions>
Suggested heading groups (use only those relevant to today's content — these are hints, not strict categories):
${headingList}
</digest_heading_suggestions>

<rules>
- ALL output must be written in ${config.outputLanguage}
- digest_text: Markdown, topic ## headings, bullet points (- )
- Each bullet 1-2 concise sentences, bold key terms
- Start with a short overview paragraph before diving into topics
- MUST include inline <id:SHORT_ID> references — copy the 8-char ID exactly as provided, do NOT modify or invent IDs
- Reference each important article at least once; only cite articles with hot_score >= 6
- ONLY return valid JSON — no text or markdown outside the JSON object
</rules>${customBlock}
`;
}

// ── Fallback Step Prompts ──────────────────────────────────────────────────
// Used by the 4-step plain-text fallback in summarizer.ts when JSON mode fails.

export function buildFallbackStep1System(lang: string): string {
  return `You are a news summarization assistant. Always respond in ${lang}. Return only the summary — do NOT repeat the task, add notes, or explain.`;
}

export function buildFallbackStep1User(lang: string, title: string, content: string): string {
  return `Summarize the following article in 2-3 sentences in ${lang}:\n\n${title}\n\n${content}`;
}

export function buildFallbackStep2System(lang: string): string {
  return `You are a tech news summarization assistant. Always write in ${lang}. Return a structured Markdown summary. Preserve technical terms (AI, API, LLM, etc.). Do NOT repeat the task or add meta-commentary.`;
}

export function buildFallbackStep2User(lang: string, title: string, content: string): string {
  return `Write a detailed Markdown summary in ${lang} for the following article. Use ## for headings, - for bullet points, **bold** for key terms.\n\n${title}\n\n${content}`;
}

export const FALLBACK_STEP3_SYSTEM =
  'You are a news importance scorer. Return ONLY a single integer from 1 to 10. No explanation.';

export function buildFallbackStep3User(title: string, overview: string): string {
  return `Rate the importance of this article (1=low, 10=very hot):\n\n${title}\n${overview}`;
}

export function buildFallbackStep4System(allowedTags: string[]): string {
  return `You are a tag assignment system. Return ONLY comma-separated tags. No explanation. Valid tags: ${allowedTags.join(', ')}`;
}

export function buildFallbackStep4User(title: string, overview: string): string {
  return `Choose at most 3 tags for this article:\n\n${title}\n${overview}`;
}
