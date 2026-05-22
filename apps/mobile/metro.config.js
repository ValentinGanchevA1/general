const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

const root = path.resolve(__dirname, '../..');

const config = {
  watchFolders: [root],
  resolver: {
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(root, 'node_modules'),
    ],
    // pnpm stores real package files under node_modules/.pnpm and exposes them
    // via symlinks. Without this flag Metro won't follow those symlinks.
    unstable_enableSymlinks: true,
    // Block the .pnpm internal store so Metro resolves each package exactly
    // once (via the symlink) and never double-counts the real path.
    blockList: [/node_modules[/\\]\.pnpm[/\\].*/],
    // Resolve @g88/shared directly to TypeScript source — no dist build required.
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === '@g88/shared') {
        return {
          filePath: path.resolve(root, 'packages/shared/src/index.ts'),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
