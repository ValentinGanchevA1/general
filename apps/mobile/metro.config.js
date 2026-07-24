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
		unstable_enableSymlinks: true,
		enableSymlinks: true,
		// Exclude apps/admin (and its React 18 tree) from Metro's watch/resolve
		// entirely -- otherwise Metro's monorepo-wide module map can pick up
		// admin's react@18.3.1 instead of mobile's own react@19.2.7, causing
		// "A React Element from an older version of React was rendered".
		blockList: /apps[\\/]admin[\\/].*/,
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
