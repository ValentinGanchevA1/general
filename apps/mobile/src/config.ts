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

function isLocalDevHost(host: string): boolean {
  if (host === 'localhost' || host === '10.0.2.2') return true;
  if (host === '127.0.0.1' || host.startsWith('127.')) return true;
  if (host.startsWith('192.168.')) return true;
  if (host.startsWith('10.')) return true;
  const m = /^172\.(\d+)\./.exec(host);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

const DEV_API_URL = isLocalDevHost(DEV_HOST)
  ? `http://${DEV_HOST}:3001`
  : `https://${DEV_HOST}`;

export const Config = {
  API_BASE_URL: __DEV__
    ? DEV_API_URL
    : 'https://g88-api.onrender.com',
  // TEST APK ONLY: this branch is dedicated to the sideload visual build.
  // Server-side premium authorization remains unchanged.
  FORCE_PROTOS_NEXUS: true,
  GOOGLE_WEB_CLIENT_ID:
    (process.env.GOOGLE_WEB_CLIENT_ID as string | undefined) ?? '',
  SENTRY_DSN: (process.env.SENTRY_DSN as string | undefined) ?? '',
} as const;
