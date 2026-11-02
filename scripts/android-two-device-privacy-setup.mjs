import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { io } = require('socket.io-client');

const STATE_FILE = process.env.DEVICE_E2E_STATE_FILE ?? '.tmp/android-two-device-privacy.json';
const BASE = process.env.DEVICE_E2E_BASE_URL ?? 'https://g88-api.onrender.com';
const API = `${BASE}/api/v1`;
const command = process.argv[2] ?? 'prepare';

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

async function register(label, runId, password) {
  const displayName = `Device Privacy ${label} ${runId.slice(-6)}`;
  const email = `device-privacy-${label.toLowerCase()}-${runId}@g88.app`;
  const { response, body } = await api('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, displayName }),
  });
  assert(response.status === 201, `register ${label} failed: HTTP ${response.status}`);
  assert(typeof body?.tokens?.accessToken === 'string', `register ${label} missing access token`);
  assert(typeof body?.user?.id === 'string', `register ${label} missing user id`);
  return {
    email,
    displayName,
    userId: body.user.id,
    accessToken: body.tokens.accessToken,
  };
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

async function openConversation(a, b) {
  const { response, body } = await api('/conversations', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${a.accessToken}`,
    },
    body: JSON.stringify({ targetUserId: b.userId }),
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

async function promoteConversation(a, b, conversationId, runId) {
  let socketA;
  let socketB;
  try {
    [socketA, socketB] = await Promise.all([
      connectSocket(a.accessToken),
      connectSocket(b.accessToken),
    ]);
    const [joinA, joinB] = await Promise.all([
      emitAck(socketA, 'conversation:join', { conversationId }),
      emitAck(socketB, 'conversation:join', { conversationId }),
    ]);
    assert(joinA.ok && joinB.ok, 'conversation join failed during setup');

    const first = await emitAck(socketA, 'chat:send', {
      conversationId,
      body: `device privacy setup ${runId}`,
      clientMessageId: `device-a-${runId}`,
    });
    assert(first.ok, 'A setup message failed');

    const reply = await emitAck(socketB, 'chat:send', {
      conversationId,
      body: 'device privacy ready',
      clientMessageId: `device-b-${runId}`,
    });
    assert(reply.ok, 'B setup reply failed');
  } finally {
    socketA?.disconnect();
    socketB?.disconnect();
  }
}

async function prepare() {
  const secret = randomBytes(12).toString('hex');
  const runId = `${Date.now()}-${secret.slice(0, 8)}`;
  const password = `DevicePass${secret}Aa1`;
  const sharedInterest = `device-privacy-${runId}`;

  const [a, b] = await Promise.all([
    register('A', runId, password),
    register('B', runId, password),
  ]);
  await Promise.all([
    completeProfile(a, sharedInterest),
    completeProfile(b, sharedInterest),
  ]);
  const conversationId = await openConversation(a, b);
  await promoteConversation(a, b, conversationId, runId);

  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(
    STATE_FILE,
    JSON.stringify({ baseUrl: BASE, password, conversationId, a, b }, null, 2),
    { mode: 0o600 },
  );
  console.log(`[device-e2e] prepared isolated A/B accounts and accepted conversation (${runId})`);
}

async function loadState() {
  return JSON.parse(await readFile(STATE_FILE, 'utf8'));
}

async function unblock() {
  const state = await loadState();
  const { response } = await api(`/blocks/${encodeURIComponent(state.b.userId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${state.a.accessToken}` },
  });
  assert(response.status === 200, `unblock failed: HTTP ${response.status}`);
  console.log('[device-e2e] restored authorized A/B relationship');
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
  if (response.status !== 204 && response.status !== 401 && response.status !== 404) {
    throw new Error(`cleanup failed: HTTP ${response.status}`);
  }
}

async function cleanup() {
  const state = await loadState().catch(() => null);
  if (!state) return;
  await Promise.allSettled([
    deleteAccount(state.a, state.password),
    deleteAccount(state.b, state.password),
  ]);
  console.log('[device-e2e] cleanup requested for synthetic accounts');
}

if (command === 'prepare') {
  await prepare();
} else if (command === 'unblock') {
  await unblock();
} else if (command === 'cleanup') {
  await cleanup();
} else {
  throw new Error(`Unsupported command: ${command}`);
}
