module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.{spec,test}.{ts,tsx}'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  // pnpm hoists packages under node_modules/.pnpm/<pkg@ver>/node_modules/<pkg>.
  // Excluding .pnpm/ from triggering the ignore rule lets the second
  // node_modules/ segment control the whitelist. Prefixes are unanchored, so
  // `react-native` also covers `react-native-*` (vector-icons, safe-area-context,
  // screens, maps) and `@react-native` covers `@react-native-community/`,
  // `@react-native-firebase/`, etc. nanoid + use-latest-callback are ESM deps
  // pulled in by @react-navigation.
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/|@react-native|@react-navigation|react-native|@testing-library/react-native|nanoid|use-latest-callback))',
  ],
  // Resolve platform-specific modules (Platform.android.js, *.native.js). RN code
  // and @react-navigation read Platform at import; without this it is undefined
  // ("Cannot read properties of undefined (reading 'select')").
  haste: {
    defaultPlatform: 'android',
    platforms: ['android', 'ios', 'native'],
  },
  // RN's jest setup mocks NativeModules/Platform/etc.; native-mocks adds stubs
  // for the third-party native modules the app imports (AsyncStorage, etc.).
  setupFiles: ['react-native/jest/setup.js', '<rootDir>/jest/native-mocks.js'],
  globals: {
    __DEV__: true,
  },
  moduleNameMapper: {
    '^@g88/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    // Real @sentry/react-native is ESM + native; stub it in unit tests.
    '^@sentry/react-native$': '<rootDir>/jest/sentry-mock.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
