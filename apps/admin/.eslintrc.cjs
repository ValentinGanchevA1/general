module.exports = {
  root: true,
  ignorePatterns: ['dist', 'vite.config.ts', 'tailwind.config.js', 'postcss.config.js'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  env: {
    browser: true,
    es2021: true,
  },
  settings: {
    react: { version: 'detect' },
  },
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/prop-types': 'off',
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
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
