const nodeExternals = require('webpack-node-externals');

/**
 * Nest's default webpack builder enables ForkTsCheckerWebpackPlugin.
 * On Render free/starter memory limits the checker process is often SIGKILL'd
 * (OOM), which fails the deploy even when webpack emits a good bundle.
 * Typecheck runs in CI (`pnpm typecheck`); skip the in-build checker here.
 */
module.exports = (options) => {
  const plugins = (options.plugins ?? []).filter(
    (p) => p?.constructor?.name !== 'ForkTsCheckerWebpackPlugin',
  );

  return {
    ...options,
    plugins,
    externals: [
      // Bundle workspace packages directly — they have no dist yet on fresh install.
      nodeExternals({ allowlist: ['@g88/shared'] }),
    ],
  };
};
