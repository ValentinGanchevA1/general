import {
  createFallbackRandomUuid,
  ensureRandomUuid,
  type RandomUuidTarget,
} from './randomUuid';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('randomUuid polyfill', () => {
  it('creates UUID-v4-shaped ids without Web Crypto', () => {
    const first = createFallbackRandomUuid(1_700_000_000_000, 123_456);
    const second = createFallbackRandomUuid(1_700_000_000_000, 123_456);

    expect(first).toMatch(UUID_V4_PATTERN);
    expect(second).toMatch(UUID_V4_PATTERN);
    expect(second).not.toBe(first);
  });

  it('installs the fallback when randomUUID is unavailable', () => {
    const target: RandomUuidTarget = {};

    ensureRandomUuid(target);

    expect(target.crypto?.randomUUID).toBeDefined();
    expect(target.crypto?.randomUUID?.()).toMatch(UUID_V4_PATTERN);
  });

  it('preserves an existing native randomUUID implementation', () => {
    const nativeRandomUuid = jest.fn(() => '00000000-0000-4000-8000-000000000001');
    const target: RandomUuidTarget = { crypto: { randomUUID: nativeRandomUuid } };

    ensureRandomUuid(target);

    expect(target.crypto?.randomUUID).toBe(nativeRandomUuid);
  });
});
