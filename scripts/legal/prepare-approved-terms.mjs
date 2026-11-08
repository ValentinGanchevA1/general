#!/usr/bin/env node
/**
 * Manual, fail-closed publication PREPARATION for NEXUS Terms of Service.
 *
 * This script checks that the *exact file* reviewed by legal counsel matches
 * the supplied approval record. It cannot establish that counsel actually
 * approved the content. Release owner must verify the approval independently.
 *
 * Dry run: node scripts/legal/prepare-approved-terms.mjs
 * Write (only after review): node scripts/legal/prepare-approved-terms.mjs --write
 *
 * Never run --write as an automatic CI/deploy job. A separate reviewed PR
 * must publish docs/legal/terms/index.html to Render's public site.
 */
import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const SOURCE = 'docs/legal-review/NEXUS_TERMS_CANDIDATE.html';
export const APPROVAL = 'docs/legal-review/NEXUS_TERMS_APPROVAL.json';
export const DESTINATION = 'docs/legal/terms/index.html';
const versionRe = /^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/;
const dateRe = /^\d{4}-\d{2}-\d{2}$/;

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function validateApprovedTerms(html, record) {
  const problems = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['Valid signed-off approval metadata is required'];
  }
  if (record.status !== 'approved') problems.push('approval.status must be approved');
  if (!versionRe.test(record.version ?? '')) problems.push('Valid immutable Terms version is required');
  if (!dateRe.test(record.effectiveDate ?? '') || !Number.isFinite(Date.parse(record.effectiveDate ?? ''))) {
    problems.push('Valid effectiveDate YYYY-MM-DD required');
  }
  if (!dateRe.test(record.approvedAt ?? '') || !Number.isFinite(Date.parse(record.approvedAt ?? ''))) {
    problems.push('Valid approvedAt YYYY-MM-DD required');
  }
  if (String(record.approvedBy?.name ?? '').trim().length < 5 ||
      String(record.approvedBy?.role ?? '').trim().length < 5) {
    problems.push('Identified human legal approver and role required');
  }
  if (!/^[0-9a-f]{64}$/i.test(record.contentSha256 ?? '') ||
      record.contentSha256?.toLowerCase() !== sha256(html)) {
    problems.push('Exact reviewed HTML SHA-256 does not match approval');
  }
  if (!/<!doctype html>/i.test(html) || !/<html\b/i.test(html)) {
    problems.push('Complete HTML5 page required');
  }
  if (!/<title>[^<]*NEXUS[^<]*Terms of Service[^<]*<\/title>/i.test(html) ||
      !/<h1[^>]*>\s*Terms of Service\s*<\/h1>/i.test(html)) {
    problems.push('NEXUS-branded Terms title and H1 required');
  }
  if (!html.includes(`NEXUS_TERMS_VERSION=${record.version}`)) {
    problems.push('HTML must embed the exact approved version in an NEXUS_TERMS_VERSION comment');
  }
  if (!html.includes(`datetime="${record.effectiveDate}"`)) {
    problems.push('HTML must display effective date in a time datetime attribute');
  }
  if (!/href=["']https:\/\/g88-legal\.onrender\.com\/privacy\/?["']/i.test(html)) {
    problems.push('Link to separate public Privacy Policy required');
  }
  if (!/name=["']robots["']\s+content=["']index,follow["']/i.test(html)) {
    problems.push('Publication copy must be index,follow (not a noindex draft)');
  }
  if (!/community|prohibited/i.test(html) || !/report/i.test(html) ||
      !/block/i.test(html) || !/location/i.test(html) ||
      !/delete|deletion/i.test(html)) {
    problems.push('Terms must contain key UGC, safety, location and deletion disclosures');
  }
  // Intentionally conservative. A human editor must remove all unfinished
  // legal prose and reviewer placeholders before publication.
  if (/DRAFT|UNAPPROVED|TODO|FIXME|\[(?:LEGAL|COUNSEL|VERIFY|APPROVED_|EFFECTIVE_|PLACEHOLDER|PUBLIC_|OPERATOR|REVIEW|DEFINE|SAFETY)/i.test(html)) {
    problems.push('Reviewer placeholders / draft warnings remain in HTML');
  }
  if (/<script\b|javascript:|on(?:load|error|click)\s*=/i.test(html)) {
    problems.push('Terms HTML must not contain executable JavaScript');
  }
  return problems;
}

function main() {
  const write = process.argv.includes('--write');
  const source = resolve(repoRoot, SOURCE);
  const approvalPath = resolve(repoRoot, APPROVAL);
  if (!existsSync(source) || !existsSync(approvalPath)) {
    console.error('NOT READY: Counsel-approved candidate and its approval metadata are missing.');
    console.error(`Expected: ${SOURCE} and ${APPROVAL}`);
    process.exitCode = 1;
    return;
  }
  const html = readFileSync(source, 'utf8');
  let record;
  try { record = JSON.parse(readFileSync(approvalPath, 'utf8')); }
  catch { console.error('NOT READY: Approval metadata is not valid JSON.'); process.exitCode = 1; return; }
  const problems = validateApprovedTerms(html, record);
  if (problems.length > 0) {
    console.error('NOT READY: Terms publication validation failed:');
    problems.forEach(p => console.error(`- ${p}`));
    process.exitCode = 1;
    return;
  }
  if (!write) {
    console.log(`PREPARATION PASSED — approved content SHA-256: ${sha256(html)}`);
    console.log('DRY RUN: No public file created. Independently verify counsel sign-off.');
    return;
  }
  if (process.env.NEXUS_TERMS_PUBLICATION_AUTHORIZED !== 'YES') {
    console.error('DENIED: Explicit release owner authorization required before writing public document.');
    process.exitCode = 1;
    return;
  }
  const destination = resolve(repoRoot, DESTINATION);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, html, { flag: 'wx' }); // never silently overwrite previously approved copy
  console.log(`Prepared ${DESTINATION} for human-reviewed PR. Not deployed.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
