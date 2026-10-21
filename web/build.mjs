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
});
