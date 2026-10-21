/**
 * Browser origins allowed for REST + Socket.IO.
 *
 * Credentialed CORS must always use explicit origins. Development keeps a
 * small local allowlist for the admin and browser preview; production is
 * configured only through CORS_ORIGINS and fails closed when it is missing.
 */
const REQUIRED_DEV_ORIGINS = [
  'http://127.0.0.1:5173',
  'http://localhost:5173',
  'http://127.0.0.1:4174',
  'http://localhost:4174',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
] as const;

function normalizeOrigin(value: string): string {
  const parsed = new URL(value);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported CORS origin protocol: ${parsed.protocol}`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error(`CORS_ORIGINS entries must be bare origins: ${value}`);
  }
  return parsed.origin;
}

function configuredOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)
    .map(normalizeOrigin);
}

export function corsOrigins(): string[] {
  const set = new Set<string>(configuredOrigins());

  if (process.env.NODE_ENV !== 'production') {
    for (const origin of REQUIRED_DEV_ORIGINS) set.add(origin);
  }

  return [...set];
}

export function isCorsOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    return corsOrigins().includes(normalizeOrigin(origin));
  } catch {
    return false;
  }
}

export function assertProductionCorsOrigins(): void {
  if (process.env.NODE_ENV !== 'production') return;

  const origins = corsOrigins();
  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS must contain at least one explicit HTTPS origin in production');
  }

  for (const origin of origins) {
    if (!origin.startsWith('https://')) {
      throw new Error(`Production CORS origin must use HTTPS: ${origin}`);
    }
  }
}
