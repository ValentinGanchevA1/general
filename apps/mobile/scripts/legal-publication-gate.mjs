/**
 * Production-only, fail-closed verification of the ACTUAL public legal pages.
 * Source files, HTTPS-looking constants and a successful static-site deploy are
 * not evidence that the approved Terms version is publicly served.
 *
 * No credentials, cookies, user identifiers or approval records are transmitted.
 * This check does not establish legal approval or replace manual release sign-off.
 */
import { createHash } from 'node:crypto';

const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;
const HASH_PATTERN = /^[0-9a-f]{64}$/i;
const MAX_HTML_BYTES = 1_000_000;

function normalizePath(pathname) {
  return pathname.replace(/\/+$/, '') || '/';
}

async function loadHtml(url, label, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: 'text/html' },
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    throw new Error(`[legal-gate] ${label} could not be fetched anonymously over HTTPS.`);
  }

  if (response.status !== 200) {
    throw new Error(`[legal-gate] ${label} must return HTTP 200 (received ${response.status}).`);
  }
  if (!/^text\/html\b/i.test(response.headers.get('content-type') ?? '')) {
    throw new Error(`[legal-gate] ${label} must serve HTML.`);
  }

  const requested = new URL(url);
  const finalUrl = new URL(response.url || url);
  if (finalUrl.protocol !== 'https:' ||
      finalUrl.origin !== requested.origin ||
      normalizePath(finalUrl.pathname) !== normalizePath(requested.pathname)) {
    throw new Error(`[legal-gate] ${label} redirected away from its canonical HTTPS path.`);
  }

  let bytes;
  try {
    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    throw new Error(`[legal-gate] ${label} public HTML could not be read.`);
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_HTML_BYTES) {
    throw new Error(`[legal-gate] ${label} public HTML size is invalid.`);
  }
  let html;
  try {
    html = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error(`[legal-gate] ${label} public HTML must use valid UTF-8.`);
  }
  return { html, finalUrl, bytes };
}

export async function verifyPublishedLegalPages({
  privacyUrl,
  termsUrl,
  expectedVersion,
  expectedSha256,
  fetchImpl = fetch,
}) {
  if (!VERSION_PATTERN.test(expectedVersion ?? '')) {
    throw new Error('[legal-gate] Production NEXUS_TERMS_VERSION must match the approved immutable Terms version.');
  }
  if (typeof expectedSha256 !== 'string' || !HASH_PATTERN.test(expectedSha256)) {
    throw new Error('[legal-gate] Production NEXUS_TERMS_SHA256 must be the approved exact HTML SHA-256.');
  }

  // Always check the actually served endpoints, not only Git source.
  const privacy = await loadHtml(privacyUrl, 'Privacy Policy', fetchImpl);
  const terms = await loadHtml(termsUrl, 'Terms of Service', fetchImpl);

  if (privacy.finalUrl.href === terms.finalUrl.href || privacy.html === terms.html) {
    throw new Error('[legal-gate] Terms and Privacy resolve to the same public document.');
  }
  if (!/<title[^>]*>\s*NEXUS[^<]*Privacy Policy\s*<\/title>/i.test(privacy.html) ||
      !/<h1[^>]*>\s*NEXUS Privacy Policy\s*<\/h1>/i.test(privacy.html)) {
    throw new Error('[legal-gate] The public Privacy Policy is not visibly NEXUS-branded.');
  }
  if (!/<title[^>]*>\s*NEXUS[^<]*Terms of Service\s*<\/title>/i.test(terms.html) ||
      !/<h1[^>]*>\s*Terms of Service\s*<\/h1>/i.test(terms.html)) {
    throw new Error('[legal-gate] Public Terms page title or heading is incorrect.');
  }

  const versions = [...terms.html.matchAll(/<!--\s*NEXUS_TERMS_VERSION=([A-Za-z0-9._-]+)\s*-->/g)];
  if (versions.length !== 1 || versions[0][1] !== expectedVersion) {
    throw new Error('[legal-gate] The public Terms version differs from the approved release version.');
  }
  // The published date must be a real ISO calendar date, not e.g. 2026-02-31.
  const dateValues = [...terms.html.matchAll(/<time\b[^>]*\bdatetime=["'](\d{4}-\d{2}-\d{2})["'][^>]*>/gi)];
  if (!dateValues.some(([, value]) => {
    const date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  })) {
    throw new Error('[legal-gate] Public Terms lacks a valid effective date.');
  }
  if (!/href=["']https:\/\/g88-legal\.onrender\.com\/privacy\/?["']/i.test(terms.html)) {
    throw new Error('[legal-gate] Public Terms must link to the separate Privacy Policy.');
  }
  if (!/<meta\b[^>]*name=["']robots["'][^>]*content=["']index,follow["']/i.test(terms.html) ||
      /DRAFT|UNAPPROVED|TODO|FIXME|\[(?:LEGAL|COUNSEL|VERIFY|APPROVED_|EFFECTIVE_|PLACEHOLDER|PUBLIC_|OPERATOR|REVIEW|DEFINE|SAFETY)/i.test(terms.html)) {
    throw new Error('[legal-gate] Public Terms still appears unapproved, incomplete or unpublished.');
  }
  if (/<\s*(?:script|iframe|object|embed|form|base|svg|math)\b|javascript\s*:|\bon[a-z]+\s*=|<\s*meta\b[^>]*http-equiv\s*=\s*["']?refresh\b/i.test(terms.html)) {
    throw new Error('[legal-gate] Public Terms unexpectedly contains executable script or active content.');
  }
  // The served document must be byte-for-byte equal to the human-reviewed candidate.
  // GitHub Actions must provide the approved manifest's contentSha256, not a guess.
  const liveSha256 = createHash('sha256').update(terms.bytes).digest('hex');
  if (liveSha256 !== expectedSha256.toLowerCase()) {
    throw new Error('[legal-gate] Public Terms SHA-256 differs from the approved HTML.');
  }

  // This is automated release evidence, not legal-counsel certification.
  return { verified: true, version: expectedVersion };
}
