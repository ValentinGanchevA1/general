'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { assertDisposableTarget } = require('./qa-empty-db-bootstrap.cjs');

test('accepts only the named localhost PostgreSQL 17 CI database', () => {
  assert.equal(
    assertDisposableTarget('postgresql://nexa_qa:ci-password@127.0.0.1:5432/nexa_qa_bootstrap'),
    true,
  );
});

test('accepts localhost when the PostgreSQL port is implicit', () => {
  assert.equal(
    assertDisposableTarget('postgresql://nexa_qa:ci-password@localhost/nexa_qa_bootstrap'),
    true,
  );
});

test('rejects remote Supabase and Render targets before opening a connection', () => {
  assert.throws(
    () => assertDisposableTarget('postgresql://nexa_qa:secret@db.example.supabase.co:5432/postgres'),
    /Refusing non-disposable database target/,
  );
  assert.throws(
    () => assertDisposableTarget('postgresql://nexa_qa:secret@prod-db.onrender.com:5432/postgres'),
    /Refusing non-disposable database target/,
  );
});

test('rejects connection URI query and fragment overrides before connecting', () => {
  assert.throws(
    () => assertDisposableTarget('postgresql://nexa_qa:secret@127.0.0.1:5432/nexa_qa_bootstrap?host=prod-db.onrender.com'),
    /Refusing non-disposable database target/,
  );
  assert.throws(
    () => assertDisposableTarget('postgresql://nexa_qa:secret@127.0.0.1:5432/nexa_qa_bootstrap#remote-target'),
    /Refusing non-disposable database target/,
  );
});

test('rejects wrong database names, users, ports and protocols', () => {
  assert.throws(
    () => assertDisposableTarget('postgresql://nexa_qa:secret@127.0.0.1:5432/postgres'),
    /Refusing non-disposable database target/,
  );
  assert.throws(
    () => assertDisposableTarget('postgresql://postgres:secret@127.0.0.1:5432/nexa_qa_bootstrap'),
    /Refusing non-disposable database target/,
  );
  assert.throws(
    () => assertDisposableTarget('postgresql://nexa_qa:secret@127.0.0.1:5433/nexa_qa_bootstrap'),
    /Refusing non-disposable database target/,
  );
  assert.throws(
    () => assertDisposableTarget('https://127.0.0.1/nexa_qa_bootstrap'),
    /Refusing non-disposable database target/,
  );
});
