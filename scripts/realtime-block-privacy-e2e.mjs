import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { io } = require('socket.io-client');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveBase(target) {
  if (target == null || target === '' || target === 'render') {
    return 'https://g88-api.onrender.com';
  }
  if (target === 'api') {
    return 'https://api.g88.app';
  }
  throw new Error('Unsupported REALTIME_PRIVACY_TARGET');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalUuid(value, label) {
  assert(typeof value === 'string' && UUID_PATTERN.test(value), `${label} is not a canonical UUID`);
  return value.toLowerCase();
}

async function readJson(response) {
  return response.json().catch(() => null);
}

const BASE = resolveBase(process.env.REALTIME_PRIVACY_TARGET);
const API = `${BASE}/api/v1`;
const RUN_SECRET = randomBytes(16).toString('hex');
const RUN_ID = `${Date.now()}-${RUN_SECRET.slice(0, 12)}`;
const SHARED_INTEREST = `privacy-e2e-${RUN_ID}`;
const TEST_PASSWORD = `Realtime_${RUN_SECRET}Aa1!`;
const TEST_LOCATION = Object.freeze({ lat: 52.52, lng: 13.405 });
const UPDATED_LOCATION = Object.freeze({ lat: 52.5205, lng: 13.4055 });
const RECONNECTED_LOCATION = Object.freeze({ lat: 52.521, lng: 13.406 });

async function register(label) {
  const response = await fetch(`${API}/auth/register`, {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `privacy-e2e-${label}-${RUN_ID}@g88.app`,
      password: TEST_PASSWORD,
      displayName: `Privacy E2E ${label}`,
    }),
  });
  const body = await readJson(response);
  assert(response.status === 201, `register ${label} failed: HTTP ${response.status}`);

  const token = body?.tokens?.accessToken;
  const userId = canonicalUuid(body?.user?.id, `registered ${label} user id`);
  assert(typeof token === 'string' && token.length > 0, `register ${label} response missing access token`);
  return { token, userId };
}

async function updateProfile(user) {
  const response = await fetch(`${API}/users/me/profile`, {
    method: 'PATCH',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user.token}`,
    },
    body: JSON.stringify({ interests: [SHARED_INTEREST] }),
  });
  await readJson(response);
  assert(response.status === 200, `profile interests failed: HTTP ${response.status}`);
}

async function openConversation(owner, peerUserId) {
  const response = await fetch(`${API}/conversations`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner.token}`,
    },
    body: JSON.stringify({ targetUserId: peerUserId }),
  });
  const body = await readJson(response);
  assert(response.status === 201, `open conversation failed: HTTP ${response.status}`);
  return canonicalUuid(body?.conversationId, 'conversation id');
}

async function blockUser(owner, peerUserId) {
  const safePeerId = encodeURIComponent(canonicalUuid(peerUserId, 'blocked user id'));
  const response = await fetch(`${API}/blocks/${safePeerId}`, {
    method: 'POST',
    redirect: 'error',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${owner.token}`,
    },
    body: '{}',
  });
  const body = await readJson(response);
  assert(response.status === 201, `block failed: HTTP ${response.status}`);
  assert(body?.blocked === true, 'block response did not confirm revocation');
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
    const timer = setTimeout(
      () => resolve({ ok: false, code: 'timeout' }),
      timeoutMs,
    );
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack ?? { ok: false, code: 'no_ack' });
    });
  });
}

function waitForEvent(socket, event, predicate, timeoutMs = 8_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      resolve(null);
    }, timeoutMs);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

async function expectNoEvent(socket, event, predicate, windowMs = 1_500) {
  const received = await waitForEvent(socket, event, predicate, windowMs);
  assert(received === null, `${event} leaked after revocation`);
}

function assertBlockedUpdate(ack, label) {
  assert(!ack.ok, `${label} unexpectedly accepted`);
  assert(ack.code === 'location.blocked', `${label} returned unexpected ack code`);
}

async function main() {
  console.log(`NEXA realtime block privacy E2E — ${new Date().toISOString()}`);
  console.log(`Target: ${BASE}`);

  const [a, b] = await Promise.all([register('A'), register('B')]);
  console.log('✓ registered isolated throwaway users');

  await Promise.all([updateProfile(a), updateProfile(b)]);
  console.log('✓ shared-interest request gate prepared');

  const conversationId = await openConversation(a, b.userId);
  console.log('✓ request conversation opened');

  let socketA;
  let socketB;
  try {
    [socketA, socketB] = await Promise.all([connectSocket(a.token), connectSocket(b.token)]);
    console.log('✓ both realtime clients connected');

    const [joinA, joinB] = await Promise.all([
      emitAck(socketA, 'conversation:join', { conversationId }),
      emitAck(socketB, 'conversation:join', { conversationId }),
    ]);
    assert(joinA.ok, 'A join failed');
    assert(joinB.ok, 'B join failed');
    console.log('✓ both clients joined before revocation');

    const requestMessage = await emitAck(socketA, 'chat:send', {
      conversationId,
      body: 'privacy e2e request',
      clientMessageId: `privacy-request-${RUN_ID}`,
    });
    assert(requestMessage.ok, 'request message failed');

    const reply = await emitAck(socketB, 'chat:send', {
      conversationId,
      body: 'privacy e2e accept',
      clientMessageId: `privacy-reply-${RUN_ID}`,
    });
    assert(reply.ok, 'request promotion reply failed');
    console.log('✓ conversation promoted to accepted');

    const startedForB = waitForEvent(
      socketB,
      'location:share:started',
      (event) => event?.session?.conversationId === conversationId,
    );
    const startAck = await emitAck(socketA, 'location:share:start', {
      conversationId,
      duration: '15m',
      location: TEST_LOCATION,
    });
    assert(startAck.ok, 'location start failed');
    const sessionId = canonicalUuid(startAck.data?.id, 'location session id');
    const started = await startedForB;
    assert(started, 'authorized B did not receive location:share:started');
    assert(
      started.session?.lastLocation?.lat === TEST_LOCATION.lat &&
        started.session?.lastLocation?.lng === TEST_LOCATION.lng,
      'authorized start event did not contain expected location',
    );
    console.log('✓ allowed live location delivered before block');

    await blockUser(a, b.userId);
    console.log('✓ A blocked B after both sockets had joined');

    const rejoinBlocked = await emitAck(socketB, 'conversation:join', { conversationId });
    assert(!rejoinBlocked.ok, 'blocked B unexpectedly rejoined');
    assert(rejoinBlocked.code === 'chat.forbidden', 'blocked rejoin returned unexpected code');
    console.log('✓ stale joined client cannot rejoin after block');

    const noUpdateWhileConnected = expectNoEvent(
      socketB,
      'location:share:update',
      (event) => event?.sessionId === sessionId,
    );
    const updateAfterBlock = await emitAck(socketA, 'location:share:update', {
      sessionId,
      location: UPDATED_LOCATION,
    });
    assertBlockedUpdate(updateAfterBlock, 'owner update after block');
    await noUpdateWhileConnected;
    console.log('✓ blocked pre-joined socket received no precise GPS update');

    socketB.disconnect();
    socketB = await connectSocket(b.token);
    const reconnectJoin = await emitAck(socketB, 'conversation:join', { conversationId });
    assert(!reconnectJoin.ok, 'blocked B unexpectedly joined after reconnect');
    assert(reconnectJoin.code === 'chat.forbidden', 'blocked reconnect join returned unexpected code');

    const noUpdateAfterReconnect = expectNoEvent(
      socketB,
      'location:share:update',
      (event) => event?.sessionId === sessionId,
    );
    const updateAfterReconnect = await emitAck(socketA, 'location:share:update', {
      sessionId,
      location: RECONNECTED_LOCATION,
    });
    assertBlockedUpdate(updateAfterReconnect, 'owner update after blocked peer reconnect');
    await noUpdateAfterReconnect;
    console.log('✓ blocked reconnect received no precise GPS update');

    const stopAck = await emitAck(socketA, 'location:share:stop', { sessionId });
    assert(stopAck.ok, 'location stop cleanup failed');
    console.log('✓ live-location session cleaned up');
  } finally {
    socketA?.disconnect();
    socketB?.disconnect();
  }

  console.log('\n✅ realtime block privacy E2E passed');
}

main().catch((error) => {
  console.error('\n❌ realtime block privacy E2E failed');
  console.error(error instanceof Error ? error.name : 'UnknownError');
  process.exitCode = 1;
});
