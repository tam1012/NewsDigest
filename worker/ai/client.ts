import { Env } from '../types';

/**
 * Builds Gemini request parameters based on available env config.
 *
 * Mode A — Direct Gemini API (simpler, just needs GEMINI_API_KEY):
 *   → https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...
 *
 * Mode B — Cloudflare AI Gateway (caching, logging, rate-limit dashboard):
 *   → {AI_GATEWAY_URL}/v1beta/models/{model}:generateContent
 *   → requires CF-specific auth headers
 *
 * Priority: GEMINI_API_KEY wins if both are set.
 */
export function buildGeminiRequest(
  env: Env,
  model: string,
): { url: string; headers: Record<string, string> } {
  if (env.GEMINI_API_KEY) {
    // Mode A: direct Google AI API — no Cloudflare dependency
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
      headers: { 'Content-Type': 'application/json' },
    };
  }

  // Mode B: Cloudflare AI Gateway (legacy / advanced)
  if (!env.AI_GATEWAY_URL || !env.AI_GATEWAY_TOKEN) {
    throw new Error(
      'AI not configured: set GEMINI_API_KEY (simple) or both AI_GATEWAY_URL + AI_GATEWAY_TOKEN (Cloudflare Gateway)',
    );
  }

  return {
    url: `${env.AI_GATEWAY_URL}/v1beta/models/${model}:generateContent`,
    headers: {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}`,
      'cf-aig-byok-alias': 'default',
    },
  };
}
