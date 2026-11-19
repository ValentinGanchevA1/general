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

  it('requires verified TLS for Supabase even if NODE_ENV is missing', () => {
    for (const hostname of [
      'db.hmtwlkplyjbskljntdkl.supabase.co',
      'aws-0-eu-west-1.pooler.supabase.com',
    ]) {
      const url = 'postgresql://test:SECRET@' + hostname + ':5432/postgres';
      const settings = resolvePostgresConnection(url, {});
      expect(settings.ssl).toEqual({ rejectUnauthorized: true });
      expect(() => resolvePostgresConnection(url + '?sslmode=disable', {}))
        .toThrow('Managed/production PostgreSQL requires verified TLS');
    }
  });

  it('does not confuse attacker-controlled suffixes with Supabase domains', () => {
    const url = 'postgresql://test:pw@db.supabase.co.attacker.example/postgres';
    expect(resolvePostgresConnection(url, { NODE_ENV: 'development' })).toEqual({ url });
  });

  it('supports a managed CA certificate without embedding one in source', () => {
    const ca = '-----BEGIN CERTIFICATE-----\\nTEST\\n-----END CERTIFICATE-----';
    const settings = resolvePostgresConnection(target, { NODE_ENV: 'production', DATABASE_SSL_CA_PEM: ca });
    expect(settings.ssl).toEqual({ rejectUnauthorized: true, ca });
  });

  it('fails closed on insecure production sslmode settings', () => {
    for (const mode of ['disable', 'allow', 'prefer']) {
      expect(() => resolvePostgresConnection(target + '?sslmode=' + mode,
        { NODE_ENV: 'production' })).toThrow('Managed/production PostgreSQL requires verified TLS');
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
