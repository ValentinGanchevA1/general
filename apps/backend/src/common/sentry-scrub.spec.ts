// Locks the shared Sentry scrubber (OB1) against PII/secret leakage. Imports the
// source directly (not the @g88/shared dist) so the test runs without a prebuild.
import { scrubSentryPayload, __scrubInternals } from '../../../../packages/shared/src/scrub';

const { isDeniedKey } = __scrubInternals;

describe('scrubSentryPayload — key denylist', () => {
  it.each([
    'authorization',
    'Authorization',
    'cookie',
    'Set-Cookie',
    'password',
    'user_password',
    'passwordHash',
    'token',
    'accessToken',
    'refresh_token',
    'idToken',
    'x-api-key',
    'apiKey',
    'client_secret',
    'clientSecret',
    'STRIPE_SECRET_KEY',
    'aws_secret_access_key',
    'sessionId',
    'jwt',
    'csrfToken',
    'signature',
    'DATABASE_URL',
    'connectionString',
    // PII / privacy-invariant location
    'phone',
    'phoneNumber',
    'email',
    'latitude',
    'longitude',
    'lat',
    'lng',
    'location',
    'coordinates',
    'idDocumentUrl',
    'selfieUrl',
  ])('redacts denied key %s', (key) => {
    expect(isDeniedKey(key)).toBe(true);
    const out = scrubSentryPayload({ [key]: 'super-secret-value' });
    expect(out[key]).toBe('[redacted]');
  });

  it('does not over-redact ordinary keys', () => {
    for (const key of ['username', 'displayName', 'message', 'translated', 'related', 'status', 'count', 'mapping']) {
      expect(isDeniedKey(key)).toBe(false);
    }
  });

  it('redacts denied keys regardless of nesting depth', () => {
    const event = {
      request: { headers: { authorization: 'Bearer abc.def.ghi', host: 'api.g88.app' } },
      extra: { user: { email: 'a@b.com', displayName: 'Val' } },
      tags: [{ key: 'refreshToken', value: 'opaque-token' }],
    };
    const out = scrubSentryPayload(event);
    expect(out.request.headers.authorization).toBe('[redacted]');
    expect(out.request.headers.host).toBe('api.g88.app');
    expect(out.extra.user.email).toBe('[redacted]');
    expect(out.extra.user.displayName).toBe('Val');
    expect(out.tags[0]?.value).toBe('opaque-token'); // key is "value", not denied
    expect(out.tags[0]?.key).toBe('refreshToken');
  });
});

describe('scrubSentryPayload — value redaction', () => {
  const cases: Array<[string, string, RegExp]> = [
    ['Bearer token', 'Authorization: Bearer eyJhbGciOi.JzdWIiOiI.SflKxwRJ', /Bearer \[redacted\]/],
    ['Basic auth', 'Authorization: Basic dXNlcjpwYXNz', /Basic \[redacted\]/],
    ['standalone JWT', 'logged in with eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.abc123', /\[redacted-jwt\]/],
    ['stripe secret key', 'using sk_live_abcd1234EFGH5678', /\[redacted-stripe-key\]/],
    ['stripe test key', 'using sk_test_abcd1234EFGH5678', /\[redacted-stripe-key\]/],
    ['stripe webhook secret', 'whsec_abcd1234EFGH5678ijkl', /\[redacted-stripe-key\]/],
    ['google oauth token', 'tok ya29.a0AfH6SMBxyzABC.def', /\[redacted-google-token\]/],
    ['aws access key id', 'key AKIAIOSFODNN7EXAMPLE here', /\[redacted-aws-key\]/],
    ['url credentials', 'postgres://dbuser:s3cretpw@db.host:5432/g88', /postgres:\/\/\[redacted\]@/],
    ['query token param', 'GET /cb?code=abc123&state=xyz', /code=\[redacted\]/],
    ['query api_key param', 'GET /x?api_key=deadbeef&page=2', /api_key=\[redacted\]/],
  ];

  it.each(cases)('redacts %s', (_name, input, expected) => {
    const out = scrubSentryPayload({ msg: input }) as { msg: string };
    expect(out.msg).toMatch(expected);
    // The raw secret material must not survive.
    expect(out.msg).not.toMatch(/eyJhbGciOiJIUzI1NiJ9\.eyJzdWIiOiIxIn0\.abc123/);
  });

  it('leaves a non-sensitive query param intact', () => {
    const out = scrubSentryPayload({ msg: 'GET /x?api_key=deadbeef&page=2' }) as { msg: string };
    expect(out.msg).toContain('page=2');
  });

  it('redacts secrets inside arrays', () => {
    const out = scrubSentryPayload({ values: ['Bearer abc.def.ghi', 'plain'] }) as {
      values: string[];
    };
    expect(out.values[0]).toBe('Bearer [redacted]');
    expect(out.values[1]).toBe('plain');
  });
});

describe('scrubSentryPayload — robustness', () => {
  it('handles null/undefined/primitives', () => {
    expect(scrubSentryPayload(null)).toBeNull();
    expect(scrubSentryPayload(undefined)).toBeUndefined();
    expect(scrubSentryPayload(42)).toBe(42);
    expect(scrubSentryPayload(true)).toBe(true);
  });

  it('does not descend into class instances', () => {
    const err = new Error('boom');
    const out = scrubSentryPayload({ err });
    expect(out.err).toBe(err); // returned untouched, not cloned
  });

  it('stops at max depth without throwing', () => {
    let deep: Record<string, unknown> = { password: 'leak' };
    for (let i = 0; i < 20; i++) deep = { nested: deep };
    expect(() => scrubSentryPayload(deep)).not.toThrow();
  });
});
