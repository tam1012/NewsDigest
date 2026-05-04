/** Normalize date-like input to ISO 8601 UTC. */
export function normalizeDate(raw?: string | null): string {
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Get YYYY-MM-DD for Vietnam local date (UTC+7). */
export function getVnDateString(now: Date = new Date()): string {
  const vnOffsetMs = 7 * 60 * 60 * 1000;
  return new Date(now.getTime() + vnOffsetMs).toISOString().slice(0, 10);
}
