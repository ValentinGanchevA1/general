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
