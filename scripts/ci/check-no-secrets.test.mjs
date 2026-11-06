import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const guardPath = fileURLToPath(new URL('./check-no-secrets.sh', import.meta.url));
const gitPath = spawnSync('which', ['git'], { encoding: 'utf8' }).stdout.trim();
assert.ok(gitPath, 'git must be installed to test the secret scanner');

function runGuard(files, { simulateGrepFailure = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'nexa-secret-guard-'));
  try {
    const scriptPath = join(root, 'scripts/ci/check-no-secrets.sh');
    mkdirSync(dirname(scriptPath), { recursive: true });
    copyFileSync(guardPath, scriptPath);

    for (const [relativePath, content] of Object.entries(files)) {
      const destination = join(root, relativePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, content);
    }

    const init = spawnSync(gitPath, ['init', '--quiet'], { cwd: root, encoding: 'utf8' });
    assert.equal(init.status, 0, init.stderr);
    const add = spawnSync(gitPath, ['add', '--all'], { cwd: root, encoding: 'utf8' });
    assert.equal(add.status, 0, add.stderr);

    const env = { ...process.env };
    if (simulateGrepFailure) {
      const bin = join(root, 'test-bin');
      mkdirSync(bin);
      const stub = join(bin, 'git');
      writeFileSync(stub, '#!/usr/bin/env bash\nif [[ "$1" == "grep" ]]; then echo "simulated grep failure" >&2; exit 128; fi\nexec "$REAL_GIT" "$@"\n');
      chmodSync(stub, 0o755);
      env.REAL_GIT = gitPath;
      env.PATH = `${bin}:${process.env.PATH ?? ''}`;
    }

    return spawnSync('bash', [scriptPath], { cwd: root, encoding: 'utf8', env });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test('allows clean code and .env.example template', () => {
  const result = runGuard({ 'src/index.ts': 'export const ready = true;\n', '.env.example': 'SAFE_VALUE=example\n' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('rejects a tracked env file', () => {
  const result = runGuard({ 'config/.env.production': 'A_VALUE=test-placeholder\n' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Tracked \.env files|Forbidden tracked file/);
});

test('detects a fake GitHub token in TypeScript', () => {
  const dummyToken = 'ghp_' + 'A'.repeat(36);
  const result = runGuard({ 'src/config.ts': `export const token = '${dummyToken}';\n` });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /Possible secrets in tracked content/);
});

test('scans Markdown documentation, not only code', () => {
  const dummyAwsAccessKey = 'AKIA' + 'A'.repeat(16);
  const result = runGuard({ 'docs/example.md': `Example exposed credential: ${dummyAwsAccessKey}\n` });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /docs\/example\.md/);
});

test('fails closed if git grep fails', () => {
  const result = runGuard({ 'src/clean.ts': 'export const safe = true;\n' }, { simulateGrepFailure: true });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Secret content scan failed.*128/);
});
