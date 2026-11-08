import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sha256, validateApprovedTerms } from './prepare-approved-terms.mjs';

const version = '2026-11-nexus-v1';
const html = `<!doctype html><html lang="en">
<head><title>NEXUS — Terms of Service</title><meta name="robots" content="index,follow"></head>
<body><!-- NEXUS_TERMS_VERSION=${version} -->
<h1>Terms of Service</h1>
<time datetime="2026-11-10">10 November 2026</time>
<a href="https://g88-legal.onrender.com/privacy">Privacy Policy</a>
<section>Prohibited community content and behavior, report and block tools,
precise chat location, account deletion.</section></body></html>`;
const approval = {
  status: 'approved', version, effectiveDate: '2026-11-10',
  approvedAt: '2026-11-09', approvedBy: { name: 'Reviewer Example', role: 'Legal Counsel' },
  contentSha256: sha256(html),
};

test('refuses unpublished or placeholder draft', () => {
  const bad = validateApprovedTerms(html.replace('Terms of Service</h1>',
    'Terms of Service</h1><strong>UNAPPROVED DRAFT [COUNSEL TODO]</strong>'), approval);
  assert.ok(bad.length > 0);
});

test('validates complete matching approval packet without writing a file', () => {
  assert.deepEqual(validateApprovedTerms(html, approval), []);
});

test('detects exact HTML content drift after approval', () => {
  assert.match(validateApprovedTerms(html.replace('community', 'community-safe'), approval).join(' '), /SHA-256/);
});

test('fails closed without recorded human approval, version or date', () => {
  assert.match(validateApprovedTerms(html, { ...approval, status: 'review' }).join(' '), /status/);
  assert.match(validateApprovedTerms(html, { ...approval, approvedAt: '' }).join(' '), /approvedAt/);
  assert.match(validateApprovedTerms(html, { ...approval, version: 'wrong' }).join(' '), /version/);
  assert.match(validateApprovedTerms(html, { ...approval, approvedBy: null }).join(' '), /approver/);
});

test('rejects active scripts or publication of a noindex preview', () => {
  assert.match(validateApprovedTerms(html + '<script>alert(1)</script>', {
    ...approval, contentSha256: sha256(html + '<script>alert(1)</script>'),
  }).join(' '), /JavaScript/);
  const blocked = html.replace('index,follow', 'noindex,nofollow');
  assert.match(validateApprovedTerms(blocked, {
    ...approval, contentSha256: sha256(blocked),
  }).join(' '), /index,follow/);
});
