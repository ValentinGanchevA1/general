'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname, 'build-backend.sh'), 'utf8');

test('Render backend build is static and does not invoke database migration tools', () => {
  assert.match(script, /^#!\/usr\/bin\/env bash/m);
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /pnpm --filter @g88\/shared run build/);
  assert.match(script, /npx nest build/);
  assert.doesNotMatch(script, /migration:run|scripts\/migrate\.js|knex\s+migrate|typeorm\s+migration:run|supabase\s+db\s+push/i);
});
