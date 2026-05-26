module.exports = {
  presets: ['@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./src'],
        alias: { '@': './src' },
        extensions: ['.ts', '.tsx', '.js', '.jsx'],
      },
    ],
    // Inlines process.env.* at bundle time from shell env or .env files
    // loaded by Metro (e.g. via `API_HOST=x pnpm android`).
    'transform-inline-environment-variables',
  ],
};
