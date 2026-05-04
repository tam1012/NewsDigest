import { SCRAPER_SETTINGS } from './settings';

// ── Scraper Errors ─────────────────────────────────────────────────────────

/** Base class for all scraper-layer errors. */
export class ScraperError extends Error {
  constructor(message: string, public readonly url?: string) {
    super(message);
    this.name = 'ScraperError';
  }
}

/**
 * HTTP / network failure — transient, should be retried by the queue consumer.
 * Examples: connection timeout, 5xx server error, fetch abort.
 */
export class NetworkError extends ScraperError {
  constructor(message: string, public readonly status?: number, url?: string) {
    super(message, url);
    this.name = 'NetworkError';
  }
}

/**
 * Response received but malformed or unexpected format.
 * Examples: HTML returned instead of XML, broken JSON.
 * May be transient (CDN glitch) or permanent (wrong source URL type).
 */
export class ParseError extends ScraperError {
  constructor(message: string, url?: string) {
    super(message, url);
    this.name = 'ParseError';
  }
}

/**
 * Rate limited (HTTP 429) — retry with a longer delay.
 * Distinguished from NetworkError so the queue consumer can apply backoff.
 */
export class RateLimitError extends ScraperError {
  constructor(message: string, url?: string) {
    super(message, url);
    this.name = 'RateLimitError';
  }
}

/**
 * Content is permanently unavailable — do NOT retry.
 * Examples: non-article page, paywall with no extractable content,
 * a GitHub repo that genuinely has no README.
 */
export class ContentUnavailableError extends ScraperError {
  constructor(message: string, url?: string) {
    super(message, url);
    this.name = 'ContentUnavailableError';
  }
}

/**
 * Missing or invalid configuration — do NOT retry.
 * Examples: no YouTube handle in URL, env var not set.
 */
export class ConfigError extends ScraperError {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

// ── AI Errors ──────────────────────────────────────────────────────────────

/** Base class for all AI-layer errors. */
export class AiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiError';
  }
}

/**
 * Content blocked by Gemini safety filters — permanent, do NOT retry.
 * The queue consumer should ack the message and mark the article as '[blocked]'.
 */
export class ProhibitedContentError extends AiError {
  constructor(reason: string) {
    super(`AI content blocked: ${reason}`);
    this.name = 'ProhibitedContentError';
  }
}

// ── Queue Retry Strategy ────────────────────────────────────────────────────

export type RetryStrategy =
  | { action: 'ack' }
  | { action: 'retry'; delaySeconds?: number };

/**
 * Decide the queue retry strategy for a failed message based on error type.
 * Call this in the outer catch block of handleContentQueue().
 */
export function retryStrategy(err: unknown, url: string): RetryStrategy {
  // Permanent errors — ack immediately, no point retrying
  if (err instanceof ProhibitedContentError) return { action: 'ack' };
  if (err instanceof ContentUnavailableError) return { action: 'ack' };
  if (err instanceof ConfigError) return { action: 'ack' };

  // Rate limit — retry with longer delay
  if (err instanceof RateLimitError) {
    const isReddit = url.includes('reddit.com');
    return {
      action: 'retry',
      delaySeconds: isReddit
        ? SCRAPER_SETTINGS.reddit.retryDelaySeconds
        : SCRAPER_SETTINGS.retry.defaultRateLimitDelaySeconds,
    };
  }

  // NetworkError, ParseError, or unknown — retry (possibly with Reddit-specific delay)
  const isReddit = url.includes('reddit.com');
  return { action: 'retry', delaySeconds: isReddit ? SCRAPER_SETTINGS.reddit.retryDelaySeconds : undefined };
}
