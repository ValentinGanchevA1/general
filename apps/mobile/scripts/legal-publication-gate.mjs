/**
 * Production-only, fail-closed verification of the ACTUAL public legal pages.
 * Source files, HTTPS-looking constants and a successful static-site deploy are
 * not evidence that the approved Terms version is publicly served.
 *
 * No credentials, cookies, user identifiers or approval records are transmitted.
 * This check does not establish legal approval or replace manual release sign-off.
 */
const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;
const MAX_HTML_CHARS = 1_000_000;

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

  let html;
  try {
    html = await response.text();
  } catch {
    throw new Error(`[legal-gate] ${label} public HTML could not be read.`);
  }
  if (html.length === 0 || html.length > MAX_HTML_CHARS) {
    throw new Error(`[legal-gate] ${label} public HTML size is invalid.`);
  }
  return { html, finalUrl };
}

export async function verifyPublishedLegalPages({
  privacyUrl,
  termsUrl,
  expectedVersion,
  fetchImpl = fetch,
}) {
  if (!VERSION_PATTERN.test(expectedVersion ?? '')) {
    throw new Error('[legal-gate] Production NEXUS_TERMS_VERSION must match the approved immutable Terms version.');
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
  if (!/<time\b[^>]*datetime=["']\d{4}-\d{2}-\d{2}["']/i.test(terms.html)) {
    throw new Error('[legal-gate] Public Terms lacks an effective date.');
  }
  if (!/href=["']https:\/\/g88-legal\.onrender\.com\/privacy\/?["']/i.test(terms.html)) {
    throw new Error('[legal-gate] Public Terms must link to the separate Privacy Policy.');
  }
  if (!/<meta\b[^>]*name=["']robots["'][^>]*content=["']index,follow["']/i.test(terms.html) ||
      /DRAFT|UNAPPROVED|TODO|FIXME|\[(?:LEGAL|COUNSEL|VERIFY|APPROVED_|EFFECTIVE_|PLACEHOLDER|PUBLIC_|OPERATOR|REVIEW|DEFINE|SAFETY)/i.test(terms.html)) {
    throw new Error('[legal-gate] Public Terms still appears unapproved, incomplete or unpublished.');
  }
  if (/<script\b|javascript:|on(?:load|error|click)\s*=/i.test(terms.html)) {
    throw new Error('[legal-gate] Public Terms unexpectedly contains executable script.');
  }

  // This is automated release evidence, not legal-counsel certification.
  return { verified: true, version: expectedVersion };
}
