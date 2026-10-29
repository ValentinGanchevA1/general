import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { io } = require('socket.io-client');

function resolveBase(target) {
  if (target == null || target === '' || target === 'render') {
    return 'https://g88-api.onrender.com';
  }
  if (target === 'api') {
    return 'https://api.g88.app';
  }
  throw new Error('Unsupported REALTIME_PRIVACY_TARGET');
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, body: payload };
}

async function register(label) {
  const result = await request('/auth/register', {
    method: 'POST',
    body: {
      email: `privacy-e2e-${label}-${RUN_ID}@g88.app`,
      password: TEST_PASSWORD,
      displayName: `Privacy E2E ${label}`,
    },
  });
  assert(result.status === 201, `register ${label} failed: HTTP ${result.status} ${JSON.stringify(result.body)}`);
  return {
    token: result.body?.tokens?.accessToken,
    userId: result.body?.user?.id,
  };
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
    socket.on('connect_error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function emitAck(socket, event, payload, timeoutMs = 8_000) {
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ ok: false, code: 'timeout', message: `${event} ack timeout` }),
      timeoutMs,
    );
    socket.emit(event, payload, (ack) => {
      clearTimeout(timer);
      resolve(ack ?? { ok: false, code: 'no_ack', message: `${event} missing ack` });
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
  assert(received === null, `${event} leaked after revocation: ${JSON.stringify(received)}`);
}

function assertBlockedUpdate(ack, label) {
  assert(!ack.ok, `${label} unexpectedly accepted: ${JSON.stringify(ack)}`);
  assert(ack.code === 'location.blocked', `${label} returned unexpected ack: ${JSON.stringify(ack)}`);
}

async function main() {
  console.log(`NEXA realtime block privacy E2E — ${new Date().toISOString()}`);
  console.log(`Target: ${BASE}`);

  const [a, b] = await Promise.all([register('A'), register('B')]);
  assert(a.token && a.userId && b.token && b.userId, 'registration response missing auth data');
  console.log('✓ registered isolated throwaway users');

  for (const user of [a, b]) {
    const profile = await request('/users/me/profile', {
      method: 'PATCH',
      token: user.token,
      body: { interests: [SHARED_INTEREST] },
    });
    assert(profile.status === 200, `profile interests failed: HTTP ${profile.status}`);
  }
  console.log('✓ shared-interest request gate prepared');

  const opened = await request('/conversations', {
    method: 'POST',
    token: a.token,
    body: { targetUserId: b.userId },
  });
  assert(opened.status === 201, `open conversation failed: HTTP ${opened.status} ${JSON.stringify(opened.body)}`);
  const conversationId = opened.body?.conversationId;
  assert(conversationId, 'conversation response missing conversationId');
  console.log(`✓ request conversation opened: ${conversationId}`);

  let socketA;
  let socketB;
  try {
    [socketA, socketB] = await Promise.all([connectSocket(a.token), connectSocket(b.token)]);
    console.log('✓ both realtime clients connected');

    const [joinA, joinB] = await Promise.all([
      emitAck(socketA, 'conversation:join', { conversationId }),
      emitAck(socketB, 'conversation:join', { conversationId }),
    ]);
    assert(joinA.ok, `A join failed: ${JSON.stringify(joinA)}`);
    assert(joinB.ok, `B join failed: ${JSON.stringify(joinB)}`);
    console.log('✓ both clients joined before revocation');

    const requestMessage = await emitAck(socketA, 'chat:send', {
      conversationId,
      body: 'privacy e2e request',
      clientMessageId: `privacy-request-${RUN_ID}`,
    });
    assert(requestMessage.ok, `request message failed: ${JSON.stringify(requestMessage)}`);

    const reply = await emitAck(socketB, 'chat:send', {
      conversationId,
      body: 'privacy e2e accept',
      clientMessageId: `privacy-reply-${RUN_ID}`,
    });
    assert(reply.ok, `request promotion reply failed: ${JSON.stringify(reply)}`);
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
    assert(startAck.ok, `location start failed: ${JSON.stringify(startAck)}`);
    const sessionId = startAck.data?.id;
    assert(sessionId, 'location start ack missing session id');
    const started = await startedForB;
    assert(started, 'authorized B did not receive location:share:started');
    assert(
      started.session?.lastLocation?.lat === TEST_LOCATION.lat &&
        started.session?.lastLocation?.lng === TEST_LOCATION.lng,
      'authorized start event did not contain expected location',
    );
    console.log('✓ allowed live location delivered before block');

    const blocked = await request(`/blocks/${b.userId}`, {
      method: 'POST',
      token: a.token,
      body: {},
    });
    assert(blocked.status === 201, `block failed: HTTP ${blocked.status} ${JSON.stringify(blocked.body)}`);
    assert(blocked.body?.blocked === true, `block response invalid: ${JSON.stringify(blocked.body)}`);
    console.log('✓ A blocked B after both sockets had joined');

    const rejoinBlocked = await emitAck(socketB, 'conversation:join', { conversationId });
    assert(!rejoinBlocked.ok, `blocked B unexpectedly rejoined: ${JSON.stringify(rejoinBlocked)}`);
    assert(rejoinBlocked.code === 'chat.forbidden', `blocked rejoin returned unexpected code: ${JSON.stringify(rejoinBlocked)}`);
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
    assert(!reconnectJoin.ok, `blocked B unexpectedly joined after reconnect: ${JSON.stringify(reconnectJoin)}`);
    assert(reconnectJoin.code === 'chat.forbidden', `blocked reconnect join returned unexpected code: ${JSON.stringify(reconnectJoin)}`);

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
    assert(stopAck.ok, `location stop cleanup failed: ${JSON.stringify(stopAck)}`);
    console.log('✓ live-location session cleaned up');
  } finally {
    socketA?.disconnect();
    socketB?.disconnect();
  }

  console.log('\n✅ realtime block privacy E2E passed');
}

main().catch((error) => {
  console.error('\n❌ realtime block privacy E2E failed');
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
