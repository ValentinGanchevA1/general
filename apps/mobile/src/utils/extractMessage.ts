/**
 * User-facing error string from API / network failures.
 * Keeps product-authored API messages, but never exposes transport-level
 * axios/status strings directly in the UI.
 */
export function extractMessage(e: unknown, fallback: string): string {
  const raw = readRaw(e);
  const statusCode = readStatusCode(e, raw);

  if (statusCode === 429) {
    return 'Too many requests — try again shortly';
  }

  if (raw && isTransientNetwork(raw)) {
    return 'Server is waking up — try again in a few seconds';
  }

  if (raw && isTransportMessage(raw)) {
    if (statusCode !== null && statusCode >= 500) {
      return 'Something went wrong — try again in a moment';
    }
    return fallback;
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

function readStatusCode(e: unknown, raw: string | null): number | null {
  if (e !== null && typeof e === 'object' && 'statusCode' in e) {
    const statusCode = (e as { statusCode: unknown }).statusCode;
    if (typeof statusCode === 'number' && Number.isInteger(statusCode)) {
      return statusCode;
    }
  }

  if (!raw) return null;
  const match = /^request failed with status code\s+(\d{3})$/i.exec(raw.trim());
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function isTransportMessage(msg: string): boolean {
  const trimmed = msg.trim();
  const m = trimmed.toLowerCase();
  return (
    /^request failed with status code\s+\d{3}$/i.test(trimmed) ||
    /^cannot\s+(get|post|put|patch|delete)\s+\/api(?:\/|$)/i.test(trimmed) ||
    m === 'network error' ||
    m === 'failed to fetch' ||
    m === 'network request failed'
  );
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
