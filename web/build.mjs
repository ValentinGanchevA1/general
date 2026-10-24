import { build } from 'esbuild';

await build({
  entryPoints: ['web/src/app.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2022'],
  outfile: 'web/dist/app.js',
  sourcemap: true,
  logLevel: 'info',
  // The preview intentionally avoids a new pnpm workspace importer/lockfile
  // mutation. Reuse the browser-compatible Socket.IO dependency already locked
  // for apps/admin and bundle it into the web artifact at build time.
  nodePaths: ['apps/admin/node_modules'],
});
