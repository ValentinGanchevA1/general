'use strict';

// Render service previews inherit parent environment variables, potentially
// including a production DATABASE_URL. Require a purpose-specific preview
// connection before any Nest bootstrap or SQL migrations run.
const DENIED_MESSAGE = [
  'Render PR preview database isolation is unverified.',
  'Set NEXUS_PREVIEW_DATABASE_URL to a separately provisioned preview database',
  'that is NOT the inherited DATABASE_URL (different database host/name).',
  'Never point a preview at production or reuse its credentials.',
].join(' ');

function databaseIdentity(value) {
  if (typeof value !== 'string' || value.trim() === '') return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') return null;
    if (!parsed.hostname || !parsed.pathname || parsed.pathname === '/') return null;
    return `${parsed.hostname.toLowerCase()}:${parsed.port || '5432'}${decodeURIComponent(parsed.pathname)}`;
  } catch {
    return null;
  }
}

function resolveDatabaseUrl(env) {
  const inherited = env.DATABASE_URL;
  if (env.IS_PULL_REQUEST !== 'true') return inherited;

  const dedicated = env.NEXUS_PREVIEW_DATABASE_URL;
  const previewIdentity = databaseIdentity(dedicated);
  const inheritedIdentity = databaseIdentity(inherited);
  if (
    !previewIdentity ||
    (typeof inherited === 'string' && (!inheritedIdentity || previewIdentity === inheritedIdentity))
  ) {
    throw new Error(DENIED_MESSAGE);
  }
  return dedicated;
}

module.exports = { resolveDatabaseUrl };
