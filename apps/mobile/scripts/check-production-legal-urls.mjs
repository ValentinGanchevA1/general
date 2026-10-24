import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

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

for (const [label, value] of [
  ['PRIVACY_POLICY_URL', privacyUrl],
  ['TERMS_OF_SERVICE_URL', termsUrl],
]) {
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') {
    throw new Error(`[legal-gate] ${label} must use HTTPS for a production release.`);
  }
}

if (privacyUrl === termsUrl) {
  throw new Error(
    '[legal-gate] Production blocked: Terms of Service still resolves to the Privacy Policy. Resolve issue #592 and publish a dedicated Terms document first.',
  );
}

console.log('[legal-gate] Production legal URLs are distinct and HTTPS.');
