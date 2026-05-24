import { Platform } from 'react-native';

// ─── Dev API host ─────────────────────────────────────────────────────────────
// Android emulator     → '10.0.2.2'   (AVD special loopback to host machine)
// Real device via USB  → 'localhost'   requires: adb reverse tcp:3001 tcp:3001
// Real device via Wi-Fi→ '192.168.x.x' your machine's LAN IP
// iOS simulator        → 'localhost'
const DEV_HOST = Platform.OS === 'android' ? 'localhost' : 'localhost';

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
