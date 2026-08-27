/**
 * Approve (or reject) pending ID verifications via admin HTTP API.
 *
 * Usage:
 *   node --env-file-if-exists=../../.env scripts/approve-id-verification.mjs
 *   node --env-file-if-exists=../../.env scripts/approve-id-verification.mjs --user <uuid>
 *   node --env-file-if-exists=../../.env scripts/approve-id-verification.mjs --all
 *   node --env-file-if-exists=../../.env scripts/approve-id-verification.mjs --reject --user <uuid> --reason "blurry"
 *
 * Env:
 *   API_URL              default http://127.0.0.1:3001/api/v1
 *   ADMIN_EMAIL          login email (must be in ADMIN_USER_IDS)
 *   ADMIN_PASSWORD       login password
 *   ADMIN_USER_IDS       backend allow-list (not read here; required on server)
 */
import 'dotenv/config';

const API = (process.env.API_URL ?? 'http://127.0.0.1:3001/api/v1').replace(/\/$/, '');
const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
const has = (name) => process.argv.includes(name);
const targetUser = arg('--user');
const reject = has('--reject');
const all = has('--all');
const reason = arg('--reason');
const decision = reject ? 'rejected' : 'approved';

if (!email || !password) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (and ensure user UUID is in ADMIN_USER_IDS on the API).');
  process.exit(1);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} → ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function pickAccessToken(login) {
  return (
    login?.accessToken ??
    login?.tokens?.accessToken ??
    login?.access_token ??
    null
  );
}

const login = await api('/auth/login', {
  method: 'POST',
  body: { email, password },
});
const token = pickAccessToken(login);
if (!token) {
  console.error('Login response missing accessToken:', login);
  process.exit(1);
}
console.log(`Logged in as ${email}`);

const pending = await api('/admin/verifications/pending?limit=50', { token });
const items = pending?.items ?? [];
if (items.length === 0) {
  console.log('No pending ID verifications.');
  process.exit(0);
}

console.log(`Pending (${pending.total ?? items.length}):`);
for (const i of items) {
  console.log(`  ${i.userId}  ${i.displayName ?? ''}  ${i.createdAt ?? ''}  id=${i.id ?? ''}`);
}

let targets = [];
if (targetUser) {
  targets = [targetUser];
} else if (all) {
  targets = items.map((i) => i.userId);
} else if (items.length === 1) {
  targets = [items[0].userId];
  console.log(`Single pending — deciding ${decision} for ${targets[0]}`);
} else {
  console.log('\nMultiple pending. Pass --user <uuid> or --all.');
  process.exit(0);
}

for (const userId of targets) {
  const body = { decision };
  if (reason) body.reason = reason;
  try {
    const result = await api(`/admin/verifications/pending/${userId}/decide`, {
      method: 'POST',
      token,
      body,
    });
    console.log(`${decision} ${userId}:`, result ?? 'ok');
  } catch (e) {
    console.error(`Failed ${userId}:`, e.status, e.data ?? e.message);
    process.exitCode = 1;
  }
}
