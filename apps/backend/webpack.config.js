const nodeExternals = require('webpack-node-externals');

module.exports = (options) => ({
  ...options,
  externals: [
    // Bundle workspace packages directly — they have no dist yet.
    nodeExternals({ allowlist: ['@g88/shared'] }),
  ],
});
