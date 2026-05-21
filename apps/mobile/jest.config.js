module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.{spec,test}.{ts,tsx}'],
  transform: { '^.+\\.[jt]sx?$': 'babel-jest' },
  transformIgnorePatterns: ['node_modules/(?!(@react-native|react-native)/)'],
  moduleNameMapper: {
    '^@g88/shared$': '<rootDir>/../../packages/shared/dist/index.js',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
