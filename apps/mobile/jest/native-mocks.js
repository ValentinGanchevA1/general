// Mocks for native modules that have no JS implementation under jest.
// Component-render tests reach these transitively (e.g. tokenStore → AsyncStorage).
/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-keychain: in-memory generic-password store, keyed by `service`.
jest.mock('react-native-keychain', () => {
  const store = new Map();
  return {
    setGenericPassword: jest.fn((username, password, options = {}) => {
      store.set(options.service ?? 'default', { username, password });
      return Promise.resolve(true);
    }),
    getGenericPassword: jest.fn((options = {}) =>
      Promise.resolve(store.get(options.service ?? 'default') ?? false),
    ),
    resetGenericPassword: jest.fn((options = {}) => {
      store.delete(options.service ?? 'default');
      return Promise.resolve(true);
    }),
    __resetMockStore: () => store.clear(),
  };
});

jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(() => Promise.resolve(true)),
    signIn: jest.fn(() => Promise.resolve({ idToken: 'test-id-token', user: {} })),
    signInSilently: jest.fn(() => Promise.resolve({})),
    signOut: jest.fn(() => Promise.resolve()),
    isSignedIn: jest.fn(() => Promise.resolve(false)),
    getCurrentUser: jest.fn(() => Promise.resolve(null)),
  },
  GoogleSigninButton: 'GoogleSigninButton',
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

const messagingMock = () => ({
  requestPermission: jest.fn(() => Promise.resolve(1)),
  getToken: jest.fn(() => Promise.resolve('test-fcm-token')),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  setBackgroundMessageHandler: jest.fn(),
  onTokenRefresh: jest.fn(() => jest.fn()),
});
jest.mock('@react-native-firebase/messaging', () => messagingMock);
jest.mock('@react-native-firebase/app', () => ({ firebase: { app: jest.fn() } }));
