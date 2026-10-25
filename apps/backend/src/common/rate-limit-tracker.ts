import { isIP } from 'node:net';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function validIp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  return candidate !== '' && isIP(candidate) !== 0 ? candidate : null;
}

function forwardedClientIp(req: Record<string, unknown>): string | null {
  const headers = asRecord(req.headers);
  if (!headers) return null;

  const forwarded = headers['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  if (typeof raw !== 'string') return null;

  // Render documents the first X-Forwarded-For address as the real client IP.
  // Validate it before using it as a rate-limit identity so arbitrary header
  // text cannot create unbounded/spoofed tracker keys.
  return validIp(raw.split(',')[0]);
}

/**
 * Resolve the per-client identity used by the global Nest throttler.
 *
 * Render terminates public traffic behind its edge/load balancers, so the
 * socket address is a proxy address rather than the originating client. Using
 * that socket address groups unrelated users into one rate-limit bucket. Prefer
 * Render's first X-Forwarded-For address and retain safe local/direct fallbacks.
 */
export function resolveRateLimitTracker(req: Record<string, unknown>): string {
  const forwarded = forwardedClientIp(req);
  if (forwarded) return forwarded;

  const expressIp = validIp(req.ip);
  if (expressIp) return expressIp;

  const socket = asRecord(req.socket);
  const remoteAddress = socket ? validIp(socket.remoteAddress) : null;
  return remoteAddress ?? 'unknown';
}
