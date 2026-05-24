import { Platform } from 'react-native';

// ─── Dev API host ─────────────────────────────────────────────────────────────
// Android emulator     → '10.0.2.2'   (AVD special loopback to host machine)
// Android real device, USB → 'localhost'  + run: adb reverse tcp:3001 tcp:3001
// Android real device, Wi-Fi → set API_HOST env var to your machine's LAN IP
// iOS simulator        → 'localhost'
//
// Override at build time:  API_HOST=192.168.1.x pnpm --filter @g88/mobile android
const DEV_HOST: string =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.env.API_HOST as string | undefined) ??
  (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');

export const Config = {
  API_BASE_URL: __DEV__
    ? `http://${DEV_HOST}:3001`
    : 'https://api.g88.app',
  // OAuth 2.0 Web Client ID from Google Cloud Console (same value used by backend GOOGLE_CLIENT_ID)
  GOOGLE_WEB_CLIENT_ID: 'TODO_REPLACE_WITH_GOOGLE_WEB_CLIENT_ID',
  // Sentry DSN for the mobile app — create a React Native project in Sentry and paste the DSN here.
  // Public value (not a secret). Leave empty to disable Sentry in dev builds.
  SENTRY_DSN: '',
} as const;
