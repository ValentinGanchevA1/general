import { randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../apps/mobile/package.json', import.meta.url));
const { io } = require('socket.io-client');

const STATE_FILE = process.env.DEVICE_E2E_STATE_FILE ?? '.tmp/android-two-device-privacy.json';
const command = process.argv[2] ?? 'prepare';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validatedBaseUrl(value) {
  assert(typeof value === 'string' && value.trim().length > 0,
    'DEVICE_E2E_BASE_URL is required; configure a dedicated non-production QA API host.');
  let parsed;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('DEVICE_E2E_BASE_URL must be a valid HTTPS origin.');
  }
  const hostname = parsed.hostname.toLowerCase();
  assert(parsed.protocol === 'https:' && parsed.username === '' && parsed.password === ''
    && parsed.pathname === '/' && parsed.search === '' && parsed.hash === '',
    'DEVICE_E2E_BASE_URL must be an HTTPS origin without credentials, path, query or fragment.');
  const productionHosts = new Set(['g88-api.onrender.com', 'api.g88.app', 'g88.app', 'www.g88.app']);
  assert(!productionHosts.has(hostname) && !hostname.endsWith('.g88.app'),
    'Refusing to create test accounts or conversations against the Production API.');
  assert(hostname !== 'localhost' && hostname !== '127.0.0.1' && !/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname),
    'DEVICE_E2E_BASE_URL must resolve through a dedicated non-production DNS hostname.');
  return parsed.origin;
}

const BASE = validatedBaseUrl(process.env.DEVICE_E2E_BASE_URL);
const API = `${BASE}/api/v1`;

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

async function prepare() {
  const secret = randomBytes(12).toString('hex');
  const runId = `${Date.now()}-${secret.slice(0, 8)}`;
  const password = `DevicePass${secret}Aa1`;
  const state = { baseUrl: BASE, password, a: null, b: null, c: null, d: null };

  await mkdir(dirname(STATE_FILE), { recursive: true });
  const persistState = async () => {
    await writeFile(STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
  };
  await persistState();

  // Persist each account immediately so `always()` cleanup can recover even if
  // a later registration, profile update, conversation or socket setup fails.
  for (const label of ['A', 'B', 'C', 'D']) {
    const key = label.toLowerCase();
    state[key] = await register(label, runId, password);
    await persistState();
  }

  const sharedAbInterest = `device-privacy-ab-${runId}`;
  const sharedCdInterest = `device-privacy-cd-${runId}`;
  await Promise.all([
    completeProfile(state.a, sharedAbInterest),
    completeProfile(state.b, sharedAbInterest),
    completeProfile(state.c, sharedCdInterest),
    completeProfile(state.d, sharedCdInterest),
  ]);

  state.abConversationId = await openConversation(state.a, state.b);
  await persistState();
  await promoteConversation(state.a, state.b, state.abConversationId, runId, 'AB');

  state.cdConversationId = await openConversation(state.c, state.d);
  await persistState();
  await promoteConversation(state.c, state.d, state.cdConversationId, runId, 'CD');

  console.log(`[device-e2e] prepared isolated QA A/B and C/D accepted conversations (${runId})`);
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
  if (response.status !== 204 && response.status !== 404) {
    throw new Error(`cleanup failed: HTTP ${response.status}`);
  }
  return response.status === 204;
}

async function cleanup() {
  const state = await loadState().catch(() => null);
  if (!state) return;
  const entries = [['A', state.a], ['B', state.b], ['C', state.c], ['D', state.d]]
    .filter(([, user]) => typeof user?.accessToken === 'string');
  if (entries.length === 0) {
    console.log('[device-e2e] no synthetic QA accounts were created');
    return;
  }
  const results = await Promise.allSettled(entries.map(([, user]) => deleteAccount(user, state.password)));
  const failures = results.flatMap((result, index) => result.status === 'rejected'
    ? [`${entries[index][0]} (${entries[index][1]?.email ?? 'unknown account'}): ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`]
    : []);
  if (failures.length > 0) {
    throw new Error(`Synthetic QA account cleanup incomplete: ${failures.join('; ')}`);
  }
  console.log(`[device-e2e] all ${entries.length} created synthetic QA accounts deleted or already absent`);
}

if (command === 'prepare') {
  await prepare();
} else if (command === 'cleanup') {
  await cleanup();
} else {
  throw new Error(`Unsupported command: ${command}`);
}
