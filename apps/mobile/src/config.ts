import { Platform } from 'react-native';

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const Config = {
  API_BASE_URL: __DEV__
    ? `http://${DEV_HOST}:3001`
    : 'https://api.g88.app',
} as const;
