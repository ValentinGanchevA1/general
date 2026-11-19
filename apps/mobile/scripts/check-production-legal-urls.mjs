import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { validateProductionLegalUrls } from './legal-url-gate.mjs';
import { verifyPublishedLegalPages } from './legal-publication-gate.mjs';

const track = (process.env.NEXA_PLAY_TRACK ?? '').trim().toLowerCase();

if (track !== 'production') {
  console.log(`[legal-gate] track=${track || 'unset'}; production legal URL gate not required.`);
  process.exit(0);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const constantsPath = path.resolve(scriptDir, '../src/constants/app.ts');
const source = readFileSync(constantsPath, 'utf8');

function readExportedString(name) {
  const pattern = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*['\"]([^'\"]+)['\"]\\s*;`);
  const match = source.match(pattern);

  if (!match?.[1]) {
    throw new Error(`[legal-gate] Could not resolve ${name} from ${constantsPath}.`);
  }

  return match[1];
}

const privacyUrl = readExportedString('PRIVACY_POLICY_URL');
const termsUrl = readExportedString('TERMS_OF_SERVICE_URL');
validateProductionLegalUrls({ track, privacyUrl, termsUrl });

await verifyPublishedLegalPages({
  privacyUrl,
  termsUrl,
  expectedVersion: process.env.NEXUS_TERMS_VERSION,
  expectedSha256: process.env.NEXUS_TERMS_SHA256,
});

console.log('[legal-gate] Production legal URLs and published NEXUS Terms version verified.');
