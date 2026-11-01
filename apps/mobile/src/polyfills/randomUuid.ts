let fallbackSequence = 0;

interface CryptoWithRandomUuid {
  randomUUID?: () => string;
}

interface PerformanceClock {
  now: () => number;
}

export interface RandomUuidTarget {
  crypto?: CryptoWithRandomUuid;
}

function fixedHex(value: number, width: number): string {
  const safe = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
  return safe.toString(16).padStart(width, '0').slice(-width);
}

function defaultMonotonicMicros(): number {
  const clock = (globalThis as unknown as { performance?: PerformanceClock }).performance;
  return clock == null ? 0 : Math.floor(clock.now() * 1_000);
}

/**
 * React Native/Hermes does not guarantee Web Crypto randomUUID(). Group creation
 * only needs a UUID-shaped idempotency key, not a secret token, so use a
 * time/monotonic/sequence fallback when the native implementation is absent.
 */
export function createFallbackRandomUuid(
  nowMs = Date.now(),
  monotonicMicros = defaultMonotonicMicros(),
): string {
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

export function ensureRandomUuid(target: RandomUuidTarget): void {
  if (typeof target.crypto?.randomUUID === 'function') return;

  const cryptoApi = target.crypto ?? {};
  cryptoApi.randomUUID = () => createFallbackRandomUuid();
  if (target.crypto == null) target.crypto = cryptoApi;
}

ensureRandomUuid(globalThis as unknown as RandomUuidTarget);
