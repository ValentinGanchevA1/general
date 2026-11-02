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

async function createPair(firstLabel, secondLabel, runId, password) {
  const sharedInterest = `device-privacy-${firstLabel.toLowerCase()}${secondLabel.toLowerCase()}-${runId}`;
  const [first, second] = await Promise.all([
    register(firstLabel, runId, password),
    register(secondLabel, runId, password),
  ]);
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

  const [revocationPair, authorizedPair] = await Promise.all([
    createPair('A', 'B', runId, password),
    createPair('C', 'D', runId, password),
  ]);

  await mkdir(dirname(STATE_FILE), { recursive: true });
  await writeFile(
    STATE_FILE,
    JSON.stringify({
      baseUrl: BASE,
      password,
      a: revocationPair.first,
      b: revocationPair.second,
      abConversationId: revocationPair.conversationId,
      c: authorizedPair.first,
      d: authorizedPair.second,
      cdConversationId: authorizedPair.conversationId,
    }, null, 2),
    { mode: 0o600 },
  );
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
    deleteAccount(state.c, state.password),
    deleteAccount(state.d, state.password),
  ]);
  console.log('[device-e2e] cleanup requested for synthetic accounts');
}

if (command === 'prepare') {
  await prepare();
} else if (command === 'cleanup') {
  await cleanup();
} else {
  throw new Error(`Unsupported command: ${command}`);
}
