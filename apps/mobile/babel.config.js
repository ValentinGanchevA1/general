const fs = require('fs');
const path = require('path');

// Load apps/mobile/.env into process.env BEFORE the inline-env plugin runs.
// babel-plugin-transform-inline-environment-variables only inlines vars that are
// already in the environment — it does not read .env files itself. babel.config.js
// is evaluated inside each Metro transform worker, so doing it here guarantees the
// vars are present at transform time. Shell-exported vars take precedence over .env.
(() => {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const raw of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
})();

module.exports = {
  presets: ['@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: { '@': './src' },
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
    ],
    // Inlines process.env.* at bundle time. The IIFE above ensures .env is loaded
    // (shell env still wins, e.g. `API_HOST=x pnpm android`).
    'transform-inline-environment-variables',
  ],
};
