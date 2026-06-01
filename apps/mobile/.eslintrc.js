module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks', 'react-native'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  env: {
    'react-native/react-native': true,
  },
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    // Web-DOM rule: in React Native, apostrophes/quotes in <Text> render fine.
    'react/no-unescaped-entities': 'off',
    // react-hooks v7 rules that over-flag idiomatic RN patterns: refs trips on
    // `useRef(new Animated.Value()).current` + interpolate-in-render, and
    // set-state-in-effect trips on standard load-on-mount / store→local sync.
    // Kept as warnings (visible) rather than errors (build-breaking).
    'react-hooks/refs': 'warn',
    'react-hooks/set-state-in-effect': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/legacy/**', 'legacy/*', '@legacy/*'],
            message:
              'Importing from legacy/ is forbidden. See legacy/README.md and STATUS.md — port or rebuild instead.',
          },
        ],
      },
    ],
  },
};
