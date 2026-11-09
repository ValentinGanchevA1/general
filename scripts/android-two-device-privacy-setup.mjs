import { randomBytes } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { io } = require('socket.io-client');

const STATE_FILE = process.env.DEVICE_E2E_STATE_FILE ?? '.tmp/android-two-device-privacy.json';
// No implicit production endpoint: this script creates users, messages and blocks.
const BASE = (process.env.DEVICE_E2E_BASE_URL ?? '').trim().replace(/\/$/, '');
const API = `${BASE}/api/v1`;
const command = process.argv[2] ?? 'prepare';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertApprovedStagingTarget() {
  assert(
    process.env.DEVICE_E2E_STAGING_APPROVED === 'true',
    'Device E2E writes require explicit approval of an isolated staging backend.',
  );
  let target;
  try {
    target = new URL(BASE);
  } catch {
    throw new Error('DEVICE_E2E_BASE_URL must be an explicit staging HTTPS URL.');
  }
  assert(
    target.protocol === 'https:' && !target.username && !target.password &&
      target.pathname === '/' && !target.search && !target.hash,
    'Device E2E staging URL must be a credential-free HTTPS origin.',
  );
  assert(
    target.hostname.toLowerCase().replace(/\.$/, '') !== 'g88-api.onrender.com',
    'Device E2E must never create test accounts on the live NEXUS API.',
  );
}

async function readJson(response) {
  return response.json().catch(() => null);
}

async function api(path, init = {}) {
  const response = await fetch(`${API}${path}`, {
    redirect: 'error',
    ...init,
  });
  return { response, body: await readJson(response) };
}

async function register(label, runId, password, recordUser) {
  const displayName = `Device Privacy ${label} ${runId.slice(-6)}`;
  const email = `device-privacy-${label.toLowerCase()}-${runId}@g88.app`;
  const { response, body } = await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName, dateOfBirth: '1990-01-01' }),
  });
  assert(response.status === 201, `register ${label} failed: HTTP ${response.status}`);
  assert(typeof body?.tokens?.accessToken === 'string', `register ${label} missing access token`);
  assert(typeof body?.user?.id === 'string', `register ${label} missing user id`);
  const user = {
    email,
    displayName,
    userId: body.user.id,
    accessToken: body.tokens.accessToken,
  };
  // Journal each successful registration before performing further writes.
  await recordUser(label.toLowerCase(), user);
  return user;
}

async function completeProfile(user, sharedInterest) {
  const { response } = await api('/users/me/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.accessToken}`,
    },
    body: JSON.stringify({
      bio: 'Synthetic Android privacy E2E account',
      dateOfBirth: '1990-01-01',
      interests: [sharedInterest],
      goals: ['friends'],
    }),
  });
  assert(response.status === 200, `profile setup failed: HTTP ${response.status}`);
}

async function openConversation(owner, peer) {
  const { response, body } = await api('/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner.accessToken}`,
    },
    body: JSON.stringify({ targetUserId: peer.userId }),
  });
  assert(response.status === 201, `open conversation failed: HTTP ${response.status}`);
  assert(typeof body?.conversationId === 'string', 'conversation id missing');
  return body.conversationId;
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`${BASE}/realtime`, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false,
      timeout: 10_000,
    });
    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('socket connect timeout'));
    }, 10_000);
    socket.on('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.on('connect_error', () => {
      clearTimeout(timer);
      reject(new Error('socket connect failed'));
    });
  });
}

function emitAck(socket, event, payload, timeoutMs = 8_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, code: 'timeout' }), timeoutMs);
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack ?? { ok: false, code: 'no_ack' });
    });
  });
}

async function promoteConversation(owner, peer, conversationId, runId, label) {
  let ownerSocket;
  let peerSocket;
  try {
    [ownerSocket, peerSocket] = await Promise.all([
      connectSocket(owner.accessToken),
      connectSocket(peer.accessToken),
    ]);
    const [ownerJoin, peerJoin] = await Promise.all([
      emitAck(ownerSocket, 'conversation:join', { conversationId }),
      emitAck(peerSocket, 'conversation:join', { conversationId }),
    ]);
    assert(ownerJoin.ok && peerJoin.ok, `${label} conversation join failed during setup`);

    const first = await emitAck(ownerSocket, 'chat:send', {
      conversationId,
      body: `device privacy setup ${label}`,
      clientMessageId: `device-${label}-owner-${runId}`,
    });
    assert(first.ok, `${label} owner setup message failed`);

    const reply = await emitAck(peerSocket, 'chat:send', {
      conversationId,
      body: 'device privacy ready',
      clientMessageId: `device-${label}-peer-${runId}`,
    });
    assert(reply.ok, `${label} peer setup reply failed`);
  } finally {
    ownerSocket?.disconnect();
    peerSocket?.disconnect();
  }
}

async function createPair(firstLabel, secondLabel, runId, password, recordUser) {
  const sharedInterest = `device-privacy-${firstLabel.toLowerCase()}${secondLabel.toLowerCase()}-${runId}`;
  // Sequential registration avoids concurrent state-file writes.
  const first = await register(firstLabel, runId, password, recordUser);
  const second = await register(secondLabel, runId, password, recordUser);
  await Promise.all([
    completeProfile(first, sharedInterest),
    completeProfile(second, sharedInterest),
  ]);
  const conversationId = await openConversation(first, second);
  await promoteConversation(first, second, conversationId, runId, `${firstLabel}${secondLabel}`);
  return { first, second, conversationId };
}

async function prepare() {
  const secret = randomBytes(12).toString('hex');
  const runId = `${Date.now()}-${secret.slice(0, 8)}`;
  const password = `DevicePass${secret}Aa1`;

  const state = { baseUrl: BASE, runId, password, cleaned: [] };
  await mkdir(dirname(STATE_FILE), { recursive: true });
  const persist = () => writeFile(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  await persist();
  const recordUser = async (label, user) => {
    state[label] = user;
    await persist();
  };

  // Journal users before starting the next pair. Cleanup can now handle partial setup.
  const revocationPair = await createPair('A', 'B', runId, password, recordUser);
  state.abConversationId = revocationPair.conversationId;
  await persist();
  const authorizedPair = await createPair('C', 'D', runId, password, recordUser);
  state.cdConversationId = authorizedPair.conversationId;
  await persist();
  console.log(`[device-e2e] prepared isolated A/B and C/D accepted conversations (${runId})`);
}

async function loadState() {
  return JSON.parse(await readFile(STATE_FILE, 'utf8'));
}

async function deleteAccount(user, password) {
  const { response } = await api('/users/me', {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.accessToken}`,
    },
    body: JSON.stringify({ confirm: 'DELETE', password }),
  });
  // A 401 is not evidence that the synthetic account was deleted.
  if (response.status !== 204 && response.status !== 404) {
    throw new Error(`cleanup failed: HTTP ${response.status}`);
  }
}

async function cleanup() {
  const state = await loadState().catch(() => null);
  if (!state) return;
  assert(state.baseUrl === BASE, 'Refusing to clean up accounts on a different backend');
  const cleaned = new Set(Array.isArray(state.cleaned) ? state.cleaned : []);
  for (const label of ['a', 'b', 'c', 'd']) {
    if (!state[label] || cleaned.has(label)) continue;
    await deleteAccount(state[label], state.password);
    cleaned.add(label);
    state.cleaned = [...cleaned];
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  }
  await unlink(STATE_FILE);
  console.log('[device-e2e] synthetic account deletion confirmed for journaled accounts');
}

if (command === 'prepare') {
  assertApprovedStagingTarget();
  await prepare();
} else if (command === 'cleanup') {
  assertApprovedStagingTarget();
  await cleanup();
} else if (command === 'verify') {
  // Used by the shell E2E runner; performs no external writes or requests.
  assertApprovedStagingTarget();
} else {
  throw new Error(`Unsupported command: ${command}`);
}
