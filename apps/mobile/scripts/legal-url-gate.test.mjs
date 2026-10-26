import assert from 'node:assert/strict';
import test from 'node:test';

import { validateProductionLegalUrls } from './legal-url-gate.mjs';

const privacyUrl = 'https://g88-legal.onrender.com/privacy';
const termsUrl = 'https://g88-legal.onrender.com/terms';

test('non-production tracks do not require dedicated legal URLs', () => {
  assert.deepEqual(
    validateProductionLegalUrls({
      track: 'alpha',
      privacyUrl,
      termsUrl: privacyUrl,
    }),
    { required: false },
  );
});

test('production fails when Terms still resolves to Privacy', () => {
  assert.throws(
    () =>
      validateProductionLegalUrls({
        track: 'production',
        privacyUrl,
        termsUrl: privacyUrl,
      }),
    /Terms of Service still resolves to the Privacy Policy/,
  );
});

test('production fails when a legal URL is not HTTPS', () => {
  assert.throws(
    () =>
      validateProductionLegalUrls({
        track: 'production',
        privacyUrl,
        termsUrl: 'http://g88-legal.onrender.com/terms',
      }),
    /TERMS_OF_SERVICE_URL must use HTTPS/,
  );
});

test('production fails when a legal URL is malformed', () => {
  assert.throws(
    () =>
      validateProductionLegalUrls({
        track: 'production',
        privacyUrl,
        termsUrl: 'not-a-url',
      }),
    /TERMS_OF_SERVICE_URL must be a valid URL/,
  );
});

test('production accepts distinct HTTPS Privacy and Terms URLs', () => {
  assert.deepEqual(
    validateProductionLegalUrls({
      track: 'production',
      privacyUrl,
      termsUrl,
    }),
    { required: true },
  );
});
