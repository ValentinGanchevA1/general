/**
 * User-facing error string from API / network failures.
 * Special-cases cold-start timeouts and offline so map-first UX stays readable.
 */
export function extractMessage(e: unknown, fallback: string): string {
  const raw = readRaw(e);
  if (raw && isTransientNetwork(raw)) {
    return 'Server is waking up — try again in a few seconds';
  }
  if (raw) return raw;
  return fallback;
}

function readRaw(e: unknown): string | null {
  if (e !== null && typeof e === 'object' && 'message' in e) {
    const m = (e as { message: unknown }).message;
    if (typeof m === 'string' && m.trim()) return m.trim();
  }
  if (e instanceof Error && e.message.trim()) return e.message.trim();
  if (typeof e === 'string' && e.trim()) return e.trim();
  return null;
}

function isTransientNetwork(msg: string): boolean {
  const m = msg.toLowerCase();
  return (
    m.includes('timeout') ||
    m.includes('network error') ||
    m.includes('network request failed') ||
    m.includes('econnaborted') ||
    m.includes('econnrefused') ||
    m.includes('etimedout') ||
    m.includes('socket hang up') ||
    m.includes('503') ||
    m.includes('502') ||
    m.includes('504') ||
    m === 'failed to fetch'
  );
}
