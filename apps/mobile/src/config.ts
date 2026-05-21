import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const Config = {
  API_BASE_URL: __DEV__
    ? `http://${DEV_HOST}:3001`
    : 'https://api.g88.app',
  // OAuth 2.0 Web Client ID from Google Cloud Console (same value used by backend GOOGLE_CLIENT_ID)
  GOOGLE_WEB_CLIENT_ID: 'TODO_REPLACE_WITH_GOOGLE_WEB_CLIENT_ID',
} as const;
