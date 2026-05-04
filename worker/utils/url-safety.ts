import { ContentUnavailableError } from '../errors';

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return false;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isPrivateIpv6(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique local
  if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) return true; // link-local
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (isPrivateIpv4(host)) return true;
  if (host.includes(':') && isPrivateIpv6(host)) return true;
  return false;
}

/**
 * Reject non-http(s) and obvious internal/private targets.
 * This is a best-effort SSRF guard for user-triggered fetch flows.
 */
export function assertSafePublicHttpUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new ContentUnavailableError(`Invalid URL: ${rawUrl}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ContentUnavailableError(`Unsupported URL protocol: ${parsed.protocol}`, rawUrl);
  }

  if (isBlockedHostname(parsed.hostname)) {
    throw new ContentUnavailableError(`Blocked non-public host: ${parsed.hostname}`, rawUrl);
  }

  return parsed;
}
