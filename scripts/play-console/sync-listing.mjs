import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PACKAGE = 'com.g88';
const LOCALES = ['en-US', 'bg-BG'];
const BASE = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';

export function validateListing(locale, listing) {
  if (!LOCALES.includes(locale)) throw new Error('Unexpected listing locale: ' + locale);
  if (!listing || typeof listing !== 'object' || Array.isArray(listing)) {
    throw new Error(locale + ': listing must be an object');
  }
  const fields = { title: 30, shortDescription: 80, fullDescription: 4000 };
  for (const [field, max] of Object.entries(fields)) {
    const value = listing[field];
    if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
      throw new Error(locale + ': invalid ' + field);
    }
    if ([...value].length > max || value.length > max) {
      throw new Error(locale + ': ' + field + ' exceeds ' + max + ' characters');
    }
  }
  if (listing.title !== 'NEXUS') throw new Error(locale + ': public name must be NEXUS');
  if (Object.keys(listing).some((key) => !Object.hasOwn(fields, key))) {
    throw new Error(locale + ': unsupported listing field');
  }
  return listing;
}

function readListings() {
  return LOCALES.map((locale) => {
    const file = new URL('../../play-console/listings/' + locale + '.json', import.meta.url);
    return { locale, listing: validateListing(locale, JSON.parse(readFileSync(file, 'utf8'))) };
  });
}

function encodeJSON(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

async function getAccessToken(serviceAccount) {
  if (serviceAccount?.type !== 'service_account' ||
      !serviceAccount.client_email || !serviceAccount.private_key ||
      serviceAccount.token_uri !== TOKEN_ENDPOINT) {
    throw new Error('Invalid Google service account configuration');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: serviceAccount.client_email, scope: SCOPE, aud: TOKEN_ENDPOINT,
    iat: now, exp: now + 3000,
  };
  const unsigned = encodeJSON({ alg: 'RS256', typ: 'JWT' }) + '.' + encodeJSON(payload);
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = unsigned + '.' + signer.sign(serviceAccount.private_key).toString('base64url');
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw new Error('Google OAuth token request failed: HTTP ' + response.status);
  const token = await response.json();
  if (typeof token.access_token !== 'string') throw new Error('OAuth access token missing');
  return token.access_token;
}

async function playRequest(token, method, path, body) {
  const response = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json; charset=utf-8',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(45000),
  });
  // Deliberately do not log response bodies, OAuth tokens or service-account JSON.
  if (!response.ok) throw new Error('Play API ' + method + ' failed (HTTP ' + response.status + ')');
  return response.json();
}

async function main() {
  const listings = readListings();
  for (const { locale, listing } of listings) {
    console.log(locale + ': validated NEXUS listing (' +
      [...listing.shortDescription].length + ' short / ' +
      [...listing.fullDescription].length + ' full characters)');
  }
  if (!process.argv.includes('--apply')) {
    console.log('Validation only. No Play Console change was made.');
    return;
  }
  if (process.env.GITHUB_EVENT_NAME !== 'workflow_dispatch' ||
      process.env.GITHUB_REF !== 'refs/heads/master') {
    throw new Error('Play writes require a manually dispatched workflow on master');
  }
  const credentials = process.env.PLAY_SERVICE_ACCOUNT_JSON;
  if (!credentials) throw new Error('PLAY_SERVICE_ACCOUNT_JSON is not configured');
  const token = await getAccessToken(JSON.parse(credentials));
  const prefix = '/applications/' + PACKAGE + '/edits';
  const edit = await playRequest(token, 'POST', prefix, {});
  if (typeof edit.id !== 'string' || !edit.id) throw new Error('Play edit ID missing');
  const path = prefix + '/' + encodeURIComponent(edit.id);
  for (const { locale, listing } of listings) {
    await playRequest(token, 'PATCH', path + '/listings/' + locale, listing);
    console.log(locale + ': staged in Play edit');
  }
  await playRequest(token, 'POST', path + ':commit', {});
  console.log('NEXUS listing changes committed for en-US and bg-BG. No release track was modified.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(fileURLToPath(process.argv[1])).href) {
  main().catch((error) => {
    console.error('NEXUS Play listing sync failed: ' + error.message);
    process.exitCode = 1;
  });
}
