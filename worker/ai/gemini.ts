import { Env } from '../types';
import { ProhibitedContentError } from '../errors';
import { buildGeminiRequest } from './client';

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        thought?: boolean;
      }>;
    };
  }>;
  promptFeedback?: {
    blockReason?: string;
  };
}

interface GeminiCallOptions {
  systemPrompt: string;
  userPrompt: string;
  model: string;
  getOtherModel: (current: string) => string;
  generationConfig: {
    temperature: number;
    maxOutputTokens: number;
    responseMimeType?: 'application/json';
  };
  timeoutMs?: number;
  attempt?: number;
  maxRetries?: number;
  retryOnStatuses?: number[];
  retryOnTimeout?: boolean;
  retryBackoffMsBase?: number;
  logPrefix?: string;
}

function isRetryableFetchError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.name === 'AbortError' || err.name === 'TimeoutError';
}

export function extractResponseText(data: GeminiResponse): string | null {
  const parts = data.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;

  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i];
    if (part && !part.thought && typeof part.text === 'string' && part.text) return part.text;
  }

  return parts[0]?.text ?? null;
}

export function extractJson<T>(
  raw: string,
  options: { repair?: boolean; errorPrefix?: string } = {}
): T {
  const { repair = false, errorPrefix = 'Cannot extract valid JSON' } = options;
  const text = raw.trim();

  try {
    return JSON.parse(text) as T;
  } catch {
    // continue
  }

  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (blockMatch) {
    try {
      return JSON.parse(blockMatch[1].trim()) as T;
    } catch {
      // continue
    }
  }

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) {
    try {
      return JSON.parse(braceMatch[0]) as T;
    } catch {
      if (!repair) {
        throw new Error(`${errorPrefix}: ${text.slice(0, 150)}`);
      }

      const repaired = braceMatch[0]
        .replace(/,\s*$/, '')
        .replace(/([^\\])"$/, '$1"}')
        + (braceMatch[0].split('{').length > braceMatch[0].split('}').length ? '}' : '');

      try {
        return JSON.parse(repaired) as T;
      } catch {
        // continue
      }
    }
  }

  throw new Error(`${errorPrefix}: ${text.slice(0, 150)}`);
}

export async function callGemini(options: GeminiCallOptions, env: Env): Promise<string> {
  const {
    systemPrompt,
    userPrompt,
    model,
    getOtherModel,
    generationConfig,
    timeoutMs = 60000,
    attempt = 1,
    maxRetries = 3,
    retryOnStatuses = [429],
    retryOnTimeout = false,
    retryBackoffMsBase = 1000,
    logPrefix = '',
  } = options;

  const { url, headers } = buildGeminiRequest(env, model);
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (retryOnTimeout && isRetryableFetchError(err) && attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, retryBackoffMsBase * attempt));
      return callGemini(
        {
          ...options,
          attempt: attempt + 1,
        },
        env,
      );
    }
    throw err;
  }

  if (retryOnStatuses.includes(res.status) && attempt < maxRetries) {
    const nextModel = getOtherModel(model);
    const waitMs = retryBackoffMsBase * attempt;
    if (logPrefix) {
      console.log(`⏳ ${logPrefix}${model} ${res.status} — switching to ${nextModel}, waiting ${waitMs / 1000}s`);
    }
    await new Promise((r) => setTimeout(r, waitMs));
    return callGemini(
      {
        ...options,
        model: nextModel,
        attempt: attempt + 1,
      },
      env,
    );
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`AI API error [${model}] ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = (await res.json()) as GeminiResponse;
  const blockReason = data.promptFeedback?.blockReason;
  if (blockReason) throw new ProhibitedContentError(blockReason);

  const text = extractResponseText(data);
  if (!text) throw new Error('Empty AI response');
  return text;
}
