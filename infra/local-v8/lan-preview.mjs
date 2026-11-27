// Retired legacy LAN diagnostic. Clear-text network access is not permitted.
// Use the opt-in TLS static preview: infra/local-v8/lan-preview.cjs
export function start() {
  throw new Error('Legacy LAN HTTP preview is disabled. Use infra/local-v8/lan-preview.cjs instead.');
}

import { fileURLToPath } from 'node:url';
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.stderr.write('Legacy LAN HTTP preview is disabled. Use infra/local-v8/lan-preview.cjs instead.\\n');
  process.exitCode = 2;
}
