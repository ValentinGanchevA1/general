import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const source = readFileSync(
  fileURLToPath(new URL('../../.github/workflows/android-release.yml', import.meta.url)),
  'utf8',
);

function stepBody(name) {
  const header = `      - name: ${name}\n`;
  const start = source.indexOf(header);
  assert.notEqual(start, -1, `Missing Android AAB workflow step: ${name}`);
  const next = source.indexOf('\n      - name: ', start + header.length);
  return source.slice(start, next === -1 ? source.length : next);
}

function stepCondition(name) {
  const block = stepBody(name);
  const match = block.match(/\n        if: >-\n((?:          .*\n)+)/);
  assert.ok(match, `No explicit multiline guard for ${name}`);
  return match[1].trim().replace(/\s+/g, ' ');
}

describe('Android Play Release safety policy', () => {
  it('does not publish merely because a version tag was pushed', () => {
    assert.match(source, /\n  push:\n    tags:\n      - "v\*"/);
    assert.equal(
      stepCondition('Publish to Google Play'),
      "github.event_name == 'workflow_dispatch' && inputs.publish == true && env.HAS_PLAY_SA == 'true'",
    );
  });

  it('defaults to build only and always reports skipped Play upload', () => {
    assert.match(source, /\n      publish:\n[\s\S]*?default: false/);
    assert.equal(
      stepCondition('Note when publish was skipped'),
      "github.event_name != 'workflow_dispatch' || inputs.publish != true || env.HAS_PLAY_SA != 'true'",
    );
  });

  it('requires verifiable AAB signature and rejects debug certificates', () => {
    const signature = stepBody('Verify the AAB is signed with a non-debug certificate');
    assert.match(signature, /jarsigner -verify "\$AAB"/);
    assert.match(signature, /jar verified\./);
    assert.match(signature, /keytool -printcert -jarfile "\$AAB"/);
    assert.match(signature, /Android Debug/);
    assert.match(signature, /exit 1/);
  });
});
