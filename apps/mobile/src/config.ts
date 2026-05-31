import { Platform } from 'react-native';

// ─── Build-time env vars ───────────────────────────────────────────────────────
// process.env.* is inlined at bundle time by babel-plugin-transform-inline-environment-variables.
// Set values in apps/mobile/.env (gitignored) or export before running Metro:
//   API_HOST=192.168.1.x pnpm --filter @g88/mobile android
// See apps/mobile/.env.example for all supported variables.

// Android emulator → '10.0.2.2' (AVD loopback to host); iOS sim → 'localhost'
// Real device over Wi-Fi → set API_HOST to your machine's LAN IP.
// Real device over USB  → keep default + run: adb reverse tcp:3001 tcp:3001
const DEV_HOST: string =
  (process.env.API_HOST as string | undefined) ??
  (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

// Allow API_HOST to be a full https hostname (e.g. prod on Render) or a bare
// IP/hostname for local dev. Port 3001 and http:// only apply to local IPs.
const isRemoteHost = DEV_HOST.includes('.');

const DEV_API_URL = isRemoteHost && !DEV_HOST.startsWith('192.') && !DEV_HOST.startsWith('10.')
  ? `https://${DEV_HOST}`
  : `http://${DEV_HOST}:3001`;

export const Config = {
  API_BASE_URL: __DEV__
    ? DEV_API_URL
    : 'https://g88-api.onrender.com',
  // OAuth 2.0 Web Client ID from Google Cloud Console (same value used by backend GOOGLE_CLIENT_ID)
  GOOGLE_WEB_CLIENT_ID:
    (process.env.GOOGLE_WEB_CLIENT_ID as string | undefined) ?? '',
  // Public Sentry DSN — leave empty to disable Sentry in dev builds
  SENTRY_DSN: (process.env.SENTRY_DSN as string | undefined) ?? '',
} as const;
