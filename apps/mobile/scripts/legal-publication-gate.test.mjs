import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { verifyPublishedLegalPages } from './legal-publication-gate.mjs';

const privacyUrl = 'https://g88-legal.onrender.com/privacy';
const termsUrl = 'https://g88-legal.onrender.com/terms';
const expectedVersion = '2026-11-19-v1';

const privacyHtml = `<!doctype html><html><head><title>NEXUS — Privacy Policy</title></head><body>
<h1>NEXUS Privacy Policy</h1><p>Separate privacy document</p></body></html>`;
const termsHtml = `<!doctype html><!-- NEXUS_TERMS_VERSION=2026-11-19-v1 -->
<html><head><title>NEXUS — Terms of Service</title><meta name="robots" content="index,follow"></head><body>
<h1>Terms of Service</h1><time datetime="2026-11-19">November 19, 2026</time>
<a href="https://g88-legal.onrender.com/privacy">Privacy Policy</a>
<p>Community rules for user content: report and block abusive users, protect location, and delete accounts.</p>
</body></html>`;

function fakeResponse(url, html, status = 200, contentType = 'text/html; charset=utf-8') {
  return {
    url,
    status,
    headers: { get: (name) => name.toLowerCase() === 'content-type' ? contentType : null },
    arrayBuffer: async () => new TextEncoder().encode(html).buffer,
  };
}

function makeFetch(overrides = {}) {
  const pages = {
    [privacyUrl]: fakeResponse(privacyUrl + '/', privacyHtml),
    [termsUrl]: fakeResponse(termsUrl + '/', termsHtml),
    ...overrides,
  };
  return async (url) => pages[url];
}

const sha256 = (html) => createHash('sha256').update(html, 'utf8').digest('hex');
const check = (fetchImpl, version = expectedVersion, hash = sha256(termsHtml)) =>
  verifyPublishedLegalPages({ privacyUrl, termsUrl, expectedVersion: version, expectedSha256: hash, fetchImpl });

test('passes when both distinct public HTML pages and the exact Terms version are served', async () => {
  assert.deepEqual(await check(makeFetch()), { verified: true, version: expectedVersion });
});

test('rejects missing or incorrect expected release version before making a network request', async () => {
  await assert.rejects(check(() => { throw new Error('should not fetch'); }, ''), /NEXUS_TERMS_VERSION/);
  await assert.rejects(check(makeFetch(), 'obsolete'), /version differs/);
  await assert.rejects(check(() => { throw new Error('should not fetch'); }, expectedVersion, ''), /NEXUS_TERMS_SHA256/);
});

test('rejects 404 page, non-HTML response and redirect to the Privacy path', async () => {
  await assert.rejects(check(makeFetch({ [termsUrl]: fakeResponse(termsUrl, '', 404) })), /HTTP 200/);
  await assert.rejects(check(makeFetch({ [termsUrl]: fakeResponse(termsUrl, termsHtml, 200, 'application/json') })), /serve HTML/);
  await assert.rejects(check(makeFetch({ [termsUrl]: fakeResponse(privacyUrl, termsHtml) })), /redirected away/);
});

test('rejects a server returning Privacy content for the Terms route', async () => {
  await assert.rejects(check(makeFetch({ [termsUrl]: fakeResponse(termsUrl, privacyHtml) })), /same public document/);
});

test('rejects draft/placeholder, mismatched version, and missing date', async () => {
  await assert.rejects(check(makeFetch({ [termsUrl]: fakeResponse(termsUrl, termsHtml + 'UNAPPROVED') })), /unapproved/);
  await assert.rejects(check(makeFetch({ [termsUrl]: fakeResponse(termsUrl, termsHtml.replace('2026-11-19-v1', '2026-11-18-v1')) })), /version differs/);
  await assert.rejects(check(makeFetch({ [termsUrl]: fakeResponse(termsUrl, termsHtml.replace('<time datetime="2026-11-19">November 19, 2026</time>', '')) })), /effective date/);
});

test('rejects wrong brand and executable script', async () => {
  await assert.rejects(check(makeFetch({ [termsUrl]: fakeResponse(termsUrl, termsHtml.replace('<title>NEXUS', '<title>G88')) })), /title or heading/);
  await assert.rejects(check(makeFetch({ [termsUrl]: fakeResponse(termsUrl, termsHtml + '<script>alert(1)</script>') })), /executable script/);
});

test('sanitizes transport errors and fails closed', async () => {
  await assert.rejects(
    check(async () => { throw new Error('example-secret-token'); }),
    (err) => err instanceof Error && /could not be fetched/.test(err.message) && !err.message.includes('example-secret-token'),
  );
});


test('requires exact approved HTML checksum even when version and branding match', async () => {
  const changed = termsHtml.replace('protect location', 'protect approximate and precise location');
  await assert.rejects(
    check(makeFetch({ [termsUrl]: fakeResponse(termsUrl, changed) })),
    /SHA-256 differs/,
  );
  await assert.deepEqual(
    await check(makeFetch(), expectedVersion, sha256(termsHtml).toUpperCase()),
    { verified: true, version: expectedVersion },
  );
});

test('rejects impossible effective dates in live HTML even with a matching hash', async () => {
  const changed = termsHtml.replaceAll('2026-11-19">', '2026-02-31">');
  await assert.rejects(check(
    makeFetch({ [termsUrl]: fakeResponse(termsUrl, changed) }),
    expectedVersion, sha256(changed),
  ), /effective date/);
});

test('rejects active HTML even when the approved checksum matches', async () => {
  const unsafe = [
    '<a onmouseover="alert(1)">Hover me</a>',
    '<iframe src="https://example.com/"></iframe>',
    '<form action="https://example.com/"></form>',
    '<meta http-equiv="refresh" content="0;url=https://example.com/">',
    '<svg onload="alert(1)"></svg>',
    '<a href="javascript:alert(1)">Open</a>',
  ];
  for (const snippet of unsafe) {
    const changed = termsHtml.replace('</body>', snippet + '</body>');
    await assert.rejects(check(
      makeFetch({ [termsUrl]: fakeResponse(termsUrl, changed) }),
      expectedVersion, sha256(changed),
    ), /active content/, snippet);
  }
});


test('hashes served UTF-8 bytes, including a BOM hidden by text decoding', async () => {
  const contentBytes = new TextEncoder().encode(termsHtml);
  const bomBytes = new Uint8Array([0xef, 0xbb, 0xbf, ...contentBytes]);
  const response = {
    ...fakeResponse(termsUrl, termsHtml),
    arrayBuffer: async () => bomBytes.buffer,
  };
  await assert.rejects(
    check(makeFetch({ [termsUrl]: response })),
    /SHA-256 differs/,
  );
});

test('rejects non-UTF-8 or excessively large public HTML before parsing', async () => {
  for (const body of [new Uint8Array([0xff, 0xfe]), new Uint8Array(1_000_001)]) {
    const response = {
      ...fakeResponse(termsUrl, termsHtml),
      arrayBuffer: async () => body.buffer,
    };
    await assert.rejects(
      check(makeFetch({ [termsUrl]: response })),
      /valid UTF-8|size is invalid/,
    );
  }
});
