/**
 * Isolated SQL/security QA using PostgreSQL WASM; never connects to a live DB.
 * Install PGlite in a scratch directory, then run with RESET_SQL_QA_MODULE set
 * to its absolute node_modules/@electric-sql/pglite path. No app dependency.
 * Exercises real migration, service SQL, bcrypt and session-version boundary.
 */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const repo = require('node:path').resolve(__dirname, '../../..');
const backendRequire = createRequire(`${repo}/apps/backend/package.json`);
const ts = backendRequire('typescript');
backendRequire('reflect-metadata');
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true, emitDecoratorMetadata: true, esModuleInterop: true,
  } });
  module._compile(result.outputText, filename);
};
const { PGlite } = require(process.env.RESET_SQL_QA_MODULE || '@electric-sql/pglite');
const { PasswordResetService } = require(`${repo}/apps/backend/src/modules/auth/password-reset.service.ts`);
const { PasswordResetMailer } = require(`${repo}/apps/backend/src/modules/auth/password-reset-mailer.ts`);
const { AuthService } = require(`${repo}/apps/backend/src/modules/auth/auth.service.ts`);
const bcrypt = backendRequire('bcrypt');
process.env.PASSWORD_RESET_SECRET = 'sql-integration-test-secret-only-32-characters';
process.env.SENDGRID_API_KEY = 'test-only';
process.env.SENDGRID_FROM_EMAIL = 'nexa@example.com';
(async () => {
  const pg = new PGlite();
  try {
    await pg.exec(`CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text UNIQUE, password_hash text, display_name text DEFAULT 'Tester', avatar_url text, verification_level text DEFAULT 'none', deleted_at timestamptz, updated_at timestamptz DEFAULT now());`);
    await pg.exec(fs.readFileSync(`${repo}/apps/backend/migrations/0003_refresh_tokens.sql`, 'utf8'));
    const migration = fs.readFileSync(`${repo}/apps/backend/migrations/0051_password_reset.sql`, 'utf8');
    await pg.exec(migration);
    await pg.exec(migration); // reapplication is safe
    const adapter = (handle) => ({ query: async (sql, params) => (await handle.query(sql, params)).rows });
    const db = { ...adapter(pg), transaction: (work) => pg.transaction((tx) => work(adapter(tx))) };
    const mailer = new PasswordResetMailer();
    const sent = [];
    mailer.send = async (email, resetCode) => { sent.push({ email, resetCode }); };
    const recovery = new PasswordResetService(db, { eval: async () => 1 }, mailer);
    const jwt = { sign: () => 'test-access', decode: () => ({ exp: 9999999999 }) };
    const auth = new AuthService(db, jwt);
    const user = await auth.register('person@example.com', 'old-password', 'Tester');
    await recovery.request('person@example.com');
    await recovery.deliverPending();
    assert.equal(sent.length, 1);
    const first = sent[0].resetCode;
    assert.match(first, /^\d{8}$/);
    assert.equal((await db.query('SELECT delivery_ciphertext FROM password_reset_requests'))[0].delivery_ciphertext, null);
    for (let i=0;i<5;i++) {
      await assert.rejects(recovery.reset({email:'person@example.com',resetCode:first === '00000000' ? '11111111':'00000000',newPassword:'new-password'}));
    }
    await assert.rejects(recovery.reset({email:'person@example.com',resetCode:first,newPassword:'new-password'}));
    assert.equal((await db.query('SELECT attempts FROM password_reset_requests'))[0].attempts,5);
    await recovery.request('person@example.com');
    await recovery.deliverPending();
    const second = sent[1].resetCode;
    await recovery.reset({email:'person@example.com',resetCode:second,newPassword:'new-password'});
    await assert.rejects(recovery.reset({email:'person@example.com',resetCode:second,newPassword:'other-password'}));
    await assert.rejects(auth.login('person@example.com','old-password'));
    await assert.rejects(auth.refresh(user.tokens.refreshToken));
    const updated = await auth.login('person@example.com','new-password');
    assert.ok(updated.tokens.refreshToken);
    const rows = await db.query('SELECT auth_version FROM users');
    assert.equal(rows[0].auth_version,1);
    await recovery.request('person@example.com');
    const current = (await db.query('SELECT id, delivery_ciphertext FROM password_reset_requests'))[0];
    const expiredCode = mailer.decrypt(current.delivery_ciphertext,current.id);
    await db.query("UPDATE password_reset_requests SET expires_at=NOW()-INTERVAL '1 second'");
    await assert.rejects(recovery.reset({email:'person@example.com',resetCode:expiredCode,newPassword:'other-password'}));
    await recovery.deliverPending();
    assert.equal((await db.query('SELECT * FROM password_reset_requests')).length,0);
    console.log('PASS PostgreSQL integration: migration/reapplication, outbox claim/delivery, 5-attempt lockout, resend, single use, old password/refresh rejection, new login/version, expiration/cleanup.');
  } finally { await pg.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
