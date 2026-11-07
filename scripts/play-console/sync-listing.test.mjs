import assert from 'node:assert/strict';
import { test } from 'node:test';
import { validateListing } from './sync-listing.mjs';

const valid = {
  title: 'NEXUS',
  shortDescription: 'Discover local people and events.',
  fullDescription: 'Map-first discovery with privacy-aware presence.',
};

test('accepts approved locales and exact NEXUS identity', () => {
  for (const locale of ['en-US', 'bg-BG']) {
    assert.equal(validateListing(locale, { ...valid }).title, 'NEXUS');
  }
});
test('rejects unknown languages and legacy brand', () => {
  assert.throws(() => validateListing('fr-FR', valid), /locale/);
  assert.throws(() => validateListing('en-US', { ...valid, title: 'NEXA' }), /NEXUS/);
});
test('enforces Play length limits', () => {
  assert.throws(() => validateListing('en-US', { ...valid, title: 'X'.repeat(31) }), /30/);
  assert.throws(() => validateListing('en-US', { ...valid, shortDescription: 'X'.repeat(81) }), /80/);
  assert.throws(() => validateListing('en-US', { ...valid, fullDescription: 'X'.repeat(4001) }), /4000/);
});
test('rejects ambiguous fields and whitespace', () => {
  assert.throws(() => validateListing('en-US', { ...valid, packageName: 'com.other' }), /unsupported/);
  assert.throws(() => validateListing('en-US', { ...valid, shortDescription: ' bad' }), /invalid/);
});
