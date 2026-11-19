import { resolvePostgresConnection } from './postgres-ssl';

describe('resolvePostgresConnection (no DB/network access)', () => {
  const target = 'postgresql://postgres:SECRET@db.example.test:5432/postgres';

  it('enables CA/hostname-verified TLS for production even without sslmode', () => {
    const settings = resolvePostgresConnection(target, { NODE_ENV: 'production' });
    expect(settings).toEqual({ url: target, ssl: { rejectUnauthorized: true } });
  });

  it('keeps non-TLS URI options but removes sslmode to prevent pg overriding TLS', () => {
    const settings = resolvePostgresConnection(
      target + '?sslmode=require&application_name=g88',
      { NODE_ENV: 'production' },
    );
    expect(settings.url).toContain('application_name=g88');
    expect(settings.url).not.toContain('sslmode');
    expect(settings.ssl).toEqual({ rejectUnauthorized: true });
  });

  it('supports a managed CA certificate without embedding one in source', () => {
    const ca = '-----BEGIN CERTIFICATE-----\\nTEST\\n-----END CERTIFICATE-----';
    const settings = resolvePostgresConnection(target, { NODE_ENV: 'production', DATABASE_SSL_CA_PEM: ca });
    expect(settings.ssl).toEqual({ rejectUnauthorized: true, ca });
  });

  it('fails closed on insecure production sslmode settings', () => {
    for (const mode of ['disable', 'allow', 'prefer']) {
      expect(() => resolvePostgresConnection(target + '?sslmode=' + mode,
        { NODE_ENV: 'production' })).toThrow('Production PostgreSQL requires verified TLS');
    }
  });

  it('rejects connection-string SSL file parameters that could override explicit TLS', () => {
    expect(() => resolvePostgresConnection(target + '?sslmode=require&sslrootcert=/tmp/root.crt',
      { NODE_ENV: 'production' })).toThrow('Use DATABASE_SSL_CA_PEM');
  });

  it('allows non-production localhost without TLS', () => {
    expect(resolvePostgresConnection('postgresql://dev:pw@localhost:5432/dev',
      { NODE_ENV: 'development' })).toEqual({ url: 'postgresql://dev:pw@localhost:5432/dev' });
  });

  it('never includes a supplied credential in malformed-URL errors', () => {
    try {
      resolvePostgresConnection('NOT_A_URL_SECRET', { NODE_ENV: 'production' });
      throw new Error('Expected invalid URL to be rejected');
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain('NOT_A_URL_SECRET');
    }
  });
});
