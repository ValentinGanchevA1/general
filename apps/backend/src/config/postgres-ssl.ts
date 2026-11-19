/**
 * Resolve TLS for the TypeORM runtime connection without accessing a database.
 * Never log a raw DATABASE_URL or certificate contents.
 */
type DatabaseEnvironment = {
  NODE_ENV?: string;
  DATABASE_SSL_CA_PEM?: string;
};

type VerifiedTls = { rejectUnauthorized: true; ca?: string };

type PostgresConnection = { url: string; ssl?: VerifiedTls };

const TLS_MODES = new Set(['require', 'verify-ca', 'verify-full']);
const UNSAFE_MODES = new Set(['disable', 'allow', 'prefer']);
const URL_TLS_OPTIONS = ['sslmode', 'sslcert', 'sslkey', 'sslrootcert'] as const;

export function resolvePostgresConnection(
  rawUrl: string,
  env: DatabaseEnvironment,
): PostgresConnection {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname ||
        !parsed.pathname || parsed.pathname === '/') {
      throw new Error('Invalid target');
    }
  } catch {
    throw new Error('Invalid PostgreSQL DATABASE_URL (details redacted)');
  }

  const mode = parsed.searchParams.get('sslmode')?.toLowerCase();
  if (mode && !TLS_MODES.has(mode) && !UNSAFE_MODES.has(mode)) {
    throw new Error('Unsupported PostgreSQL sslmode (details redacted)');
  }
  const production = env.NODE_ENV === 'production';
  if (production && mode && UNSAFE_MODES.has(mode)) {
    throw new Error('Production PostgreSQL requires verified TLS');
  }

  const ca = env.DATABASE_SSL_CA_PEM?.trim();
  if (ca && !/^-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----$/.test(ca)) {
    throw new Error('DATABASE_SSL_CA_PEM must contain a PEM certificate');
  }

  const tlsRequired = production || (mode != null && TLS_MODES.has(mode)) || Boolean(ca);
  if (!tlsRequired) return { url: rawUrl };

  // pg-connection-string can silently override the explicit SSL object if
  // SSL query parameters remain in the URI. Use only the verified TLS object.
  if (URL_TLS_OPTIONS.slice(1).some((option) => parsed.searchParams.has(option))) {
    throw new Error('Use DATABASE_SSL_CA_PEM instead of SSL files in DATABASE_URL');
  }
  for (const option of URL_TLS_OPTIONS) parsed.searchParams.delete(option);

  return {
    url: parsed.toString(),
    ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) },
  };
}
