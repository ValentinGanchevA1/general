import { resolveRateLimitTracker } from './rate-limit-tracker';

describe('resolveRateLimitTracker', () => {
  it('uses the first Render X-Forwarded-For client address', () => {
    expect(
      resolveRateLimitTracker({
        headers: { 'x-forwarded-for': '203.0.113.42, 10.0.0.5' },
        ip: '10.0.0.8',
        socket: { remoteAddress: '10.0.0.9' },
      }),
    ).toBe('203.0.113.42');
  });

  it('groups IPv6 privacy addresses by /64 like the built-in throttler', () => {
    expect(
      resolveRateLimitTracker({
        headers: { 'x-forwarded-for': '2001:db8:abcd:1234:1111:2222:3333:4444' },
      }),
    ).toBe('2001:db8:abcd:1234::/64');

    expect(
      resolveRateLimitTracker({
        headers: { 'x-forwarded-for': '2001:db8:abcd:1234:aaaa:bbbb:cccc:dddd' },
      }),
    ).toBe('2001:db8:abcd:1234::/64');
  });

  it('normalizes IPv4-mapped IPv6 addresses to their IPv4 identity', () => {
    expect(
      resolveRateLimitTracker({ headers: { 'x-forwarded-for': '::ffff:192.0.2.31' } }),
    ).toBe('192.0.2.31');
  });

  it('supports Node header arrays', () => {
    expect(
      resolveRateLimitTracker({
        headers: { 'x-forwarded-for': ['198.51.100.7, 10.0.0.5'] },
      }),
    ).toBe('198.51.100.7');
  });

  it('rejects non-IP forwarded values and falls back to Express req.ip', () => {
    expect(
      resolveRateLimitTracker({
        headers: { 'x-forwarded-for': 'spoofed-value, 10.0.0.5' },
        ip: '192.0.2.20',
      }),
    ).toBe('192.0.2.20');
  });

  it('falls back to the socket address for direct/local requests', () => {
    expect(
      resolveRateLimitTracker({
        headers: {},
        socket: { remoteAddress: '127.0.0.1' },
      }),
    ).toBe('127.0.0.1');
  });

  it('uses a stable final fallback when no valid address exists', () => {
    expect(resolveRateLimitTracker({ headers: {} })).toBe('unknown');
  });
});
