import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../..', import.meta.url));
const runScopedCredential = '${{ github.run_id }}-${{ github.run_attempt }}';

const workflows = [
  {
    filename: '.github/workflows/discovery-full-schema-smoke.yml',
    urlVariable: 'DATABASE_URL',
    database: 'nexa_schema_bench',
    user: 'nexa_schema',
    host: '127.0.0.1:5432',
    acknowledgement: "DISCOVERY_FULL_SCHEMA_ACK_DISPOSABLE: 'YES'",
  },
  {
    filename: '.github/workflows/discovery-postgis-benchmark.yml',
    urlVariable: 'DISCOVERY_BENCH_DATABASE_URL',
    database: 'nexa_bench',
    user: 'nexa_bench',
    host: 'localhost:5432',
    acknowledgement: "DISCOVERY_BENCH_ACK_DISPOSABLE: 'YES'",
  },
];

for (const workflow of workflows) {
  test(`${workflow.filename} uses matching run-scoped local credentials`, () => {
    const contents = readFileSync(join(root, workflow.filename), 'utf8');
    const lines = contents.split(/\r?\n/);
    const passwordLine = lines.find((line) => /^\s+POSTGRES_PASSWORD:\s+/.test(line));
    assert.ok(passwordLine, 'missing Postgres service password');
    const servicePassword = passwordLine.split('POSTGRES_PASSWORD:')[1]?.trim();
    assert.equal(servicePassword, runScopedCredential);
    const urlLine = lines.find((line) =>
      line.trimStart().startsWith(`${workflow.urlVariable}: `));
    assert.ok(urlLine, 'missing database URL');
    const connectionUrl = urlLine.split(`${workflow.urlVariable}: `)[1]?.trim();
    assert.equal(
      connectionUrl,
      `postgresql://${workflow.user}:${servicePassword}@${workflow.host}/${workflow.database}`,
      'client and service credentials must match and stay loopback-only',
    );
    assert.ok(contents.includes(workflow.acknowledgement));
    assert.ok(contents.includes('image: postgis/postgis:16-3.4'));
    assert.match(contents, /pull_request:/);
    assert.ok(
      !/postgresql:\/\/[^\s:@]+:[a-z_][a-z_0-9]*@/i.test(contents),
      'static database URL credential detected',
    );
  });
}
