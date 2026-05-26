module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.{spec,test}.{ts,tsx}'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  // pnpm hoists packages under node_modules/.pnpm/<pkg@ver>/node_modules/<pkg>.
  // The old pattern matched on the first node_modules/ (before .pnpm), causing
  // all RN packages to be skipped. Excluding .pnpm/ itself from triggering the
  // rule lets the second node_modules/ segment control the whitelist correctly.
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/|@react-native/|react-native/|@testing-library/react-native/))',
  ],
  globals: {
    __DEV__: true,
  },
  moduleNameMapper: {
    '^@g88/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
