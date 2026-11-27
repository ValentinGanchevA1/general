'use strict';

// Render PR previews can inherit the parent DATABASE_URL. This is a defense in
// depth check, not proof of network-level isolation or database permissions.
const DENIED_MESSAGE = [
  'Render PR preview database isolation is unverified.',
  'Use a dedicated preview database on a different host with separate credentials.',
  'Do not run preview migrations against an inherited production database.',
].join(' ');

function parseDatabase(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) return null;
    const name = decodeURIComponent(parsed.pathname.slice(1));
    if (!parsed.hostname || !name || !parsed.username) return null;
    return {
      host: parsed.hostname.toLowerCase(),
      port: parsed.port || '5432',
      name,
      user: decodeURIComponent(parsed.username),
    };
  } catch {
    return null;
  }
}

function isPreview(env) {
  // Render documents IS_PULL_REQUEST=true for PR previews. Also detect a
  // preview-named service if the flag was removed or misconfigured.
  const flag = String(env.IS_PULL_REQUEST || '').toLowerCase();
  const serviceName = String(env.RENDER_SERVICE_NAME || '');
  return flag === 'true' || /(?:^|[\s_-])pr[\s_-]*#?\d+(?:$|[\s_-])/i.test(serviceName);
}

function resolveDatabaseUrl(env) {
  const inherited = env.DATABASE_URL;
  if (!isPreview(env)) return inherited;

  const dedicated = env.NEXUS_PREVIEW_DATABASE_URL;
  const preview = parseDatabase(dedicated);
  const parent = parseDatabase(inherited);
  // Different host, database name and username are required as a conservative
  // preflight. This cannot verify actual privileges or hidden DNS aliases.
  if (
    !preview || !parent ||
    preview.host === parent.host ||
    preview.name === parent.name ||
    preview.user === parent.user
  ) {
    throw new Error(DENIED_MESSAGE);
  }
  return dedicated;
}

module.exports = { resolveDatabaseUrl, isPreview };
