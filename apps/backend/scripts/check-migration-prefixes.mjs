#!/usr/bin/env node
/**
 * Fail if two migration files share the same numeric prefix (e.g. dual 0030).
 * Filesystem-only — no DATABASE_URL required. Safe for CI on every PR.
 *
 * Usage: node scripts/check-migration-prefixes.mjs
 * Exit 0 = unique prefixes; exit 1 = collision.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, '..', 'migrations');

const files = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

/** @type {Map<string, string[]>} */
const byPrefix = new Map();

for (const file of files) {
  const m = file.match(/^(\d{4})_/);
  if (!m) {
    console.error(`Invalid migration name (expected NNNN_...sql): ${file}`);
    process.exit(1);
  }
  const prefix = m[1];
  const list = byPrefix.get(prefix) ?? [];
  list.push(file);
  byPrefix.set(prefix, list);
}

let ok = true;
for (const [prefix, names] of byPrefix) {
  if (names.length > 1) {
    ok = false;
    console.error(`Duplicate migration prefix ${prefix}:`);
    for (const n of names) console.error(`  - ${n}`);
  }
}

if (!ok) {
  console.error('\nFix: rename so each NNNN is unique. Update migrate.js RENAMES if a file was already applied under the old name.');
  process.exit(1);
}

const max = [...byPrefix.keys()].sort().at(-1) ?? '0000';
const next = String(Number(max) + 1).padStart(4, '0');
console.log(`OK: ${files.length} migrations, unique prefixes 0001–${max}. Next free: ${next}`);
