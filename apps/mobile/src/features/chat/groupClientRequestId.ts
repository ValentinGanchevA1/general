let fallbackSequence = 0;

interface CryptoWithRandomUuid {
  randomUUID?: () => string;
}

interface PerformanceClock {
  now: () => number;
}

function fixedHex(value: number, width: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return safe.toString(16).padStart(width, '0').slice(-width);
}

function defaultMonotonicMicros(): number {
  const clock = (globalThis as { performance?: PerformanceClock }).performance;
  return clock == null ? 0 : Math.floor(clock.now() * 1_000);
}

/**
 * Group creation needs a UUID-shaped idempotency key. Prefer native Web Crypto when
 * available. The fallback is deliberately non-secret: it only needs collision
 * resistance for retries, not unpredictability or authentication.
 */
export function createGroupClientRequestId(
  nowMs = Date.now(),
  monotonicMicros = defaultMonotonicMicros(),
): string {
  const crypto = (globalThis as { crypto?: CryptoWithRandomUuid }).crypto;
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }

  fallbackSequence = (fallbackSequence + 1) & 0xffff;
  const time = fixedHex(nowMs, 12);
  const monotonic = fixedHex(monotonicMicros, 8);
  const sequence = fixedHex(fallbackSequence, 4);

  return [
    time.slice(0, 8),
    time.slice(8, 12),
    `4${monotonic.slice(0, 3)}`,
    `8${monotonic.slice(3, 6)}`,
    `${monotonic.slice(6, 8)}${sequence}${time.slice(0, 6)}`,
  ].join('-');
}
