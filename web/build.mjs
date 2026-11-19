import { execFileSync } from 'node:child_process';
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
  define: {
    __NEXUS_PUBLIC_DEMO_ONLY__: JSON.stringify(process.env.PUBLIC_DEMO_ONLY === '1'),
  },
  // The preview intentionally avoids a new pnpm workspace importer/lockfile
  // mutation. Reuse the browser-compatible Socket.IO dependency already locked
  // for apps/admin and bundle it into the web artifact at build time.
  nodePaths: ['apps/admin/node_modules'],
});

/**
 * Fail closed on the public demo Render service when GitHub Actions results
 * are delayed or unavailable. This does not change ordinary web builds.
 */
if (process.env.PUBLIC_DEMO_ONLY === '1') {
  for (const test of [
    'web/e2e/world-switcher.contract.e2e.mjs',
    'web/e2e/world-experience.contract.e2e.mjs',
    'web/e2e/world-responsive.contract.e2e.mjs',
    'web/e2e/world-mobile-tools.contract.e2e.mjs',
    'web/e2e/world-map-context.contract.e2e.mjs',
    'web/e2e/world-demo-interactions.contract.e2e.mjs',
  ]) {
    execFileSync(process.execPath, [test], { stdio: 'inherit' });
  }
}
