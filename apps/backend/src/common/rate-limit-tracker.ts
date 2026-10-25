import { isIP } from 'node:net';

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function ipv4Hextets(value: string): [number, number] | null {
  const octets = value.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
  ) {
    return null;
  }

  return [
    (octets[0]! << 8) | octets[1]!,
    (octets[2]! << 8) | octets[3]!,
  ];
}

function parseIpv6Side(side: string): number[] | null {
  if (side === '') return [];

  const tokens = side.split(':');
  const groups: number[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token.includes('.')) {
      if (index !== tokens.length - 1) return null;
      const ipv4 = ipv4Hextets(token);
      if (!ipv4) return null;
      groups.push(...ipv4);
      continue;
    }

    if (!/^[0-9a-f]{1,4}$/i.test(token)) return null;
    groups.push(Number.parseInt(token, 16));
  }

  return groups;
}

function expandIpv6(value: string): number[] | null {
  const parts = value.toLowerCase().split('::');
  if (parts.length > 2) return null;

  const left = parseIpv6Side(parts[0] ?? '');
  const right = parseIpv6Side(parts[1] ?? '');
  if (!left || !right) return null;

  if (parts.length === 1) {
    return left.length === 8 ? left : null;
  }

  const missing = 8 - left.length - right.length;
  if (missing < 1) return null;
  return [...left, ...Array<number>(missing).fill(0), ...right];
}

function normalizeTrackerIp(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const candidate = value.trim();
  const version = isIP(candidate);

  if (version === 4) return candidate;
  if (version !== 6) return null;

  const mappedIpv4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(candidate)?.[1];
  if (mappedIpv4 && isIP(mappedIpv4) === 4) return mappedIpv4;

  const groups = expandIpv6(candidate);
  if (!groups) return null;

  // Match Nest throttler's default abuse protection: rotate-able IPv6 privacy
  // addresses from the same /64 must share one bucket.
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
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
  return normalizeTrackerIp(raw.split(',')[0]);
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

  const expressIp = normalizeTrackerIp(req.ip);
  if (expressIp) return expressIp;

  const socket = asRecord(req.socket);
  const remoteAddress = socket ? normalizeTrackerIp(socket.remoteAddress) : null;
  return remoteAddress ?? 'unknown';
}
