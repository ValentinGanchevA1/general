/**
 * G88 Synthetic Monitor — P1 critical path
 *
 * Flow: login (or register on first run) → discovery → wave → chat via socket
 *       → interest-based message request (shared-interest gate, one-message
 *         cap, recipient-reply promotion)
 *
 * Note: the message-request check registers ONE throwaway receiver per run
 * (monitor-req-<ts>@g88.app). The request→accept promotion is one-way, so a
 * reused pair could only be exercised once; a fresh receiver keeps the check
 * deterministic. These users accumulate slowly — prune periodically if needed.
 *
 * Exit 0 = all assertions pass
 * Exit 1 = any assertion failed
 *
 * Environment:
 *   MONITOR_API_URL          default: https://g88-api.onrender.com
 *   MONITOR_USER_A_EMAIL
 *   MONITOR_USER_A_PASSWORD
 *   MONITOR_USER_B_EMAIL
 *   MONITOR_USER_B_PASSWORD
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// socket.io-client is installed by the workflow (npm install socket.io-client)
// or available from the mobile's node_modules on local runs.
let io;
try {
  ({ io } = require('socket.io-client'));
} catch {
  ({ io } = require('./apps/mobile/node_modules/socket.io-client'));
}

const BASE = (process.env.MONITOR_API_URL ?? 'https://g88-api.onrender.com').replace(/\/$/, '');
const API  = `${BASE}/api/v1`;

const USER_A = {
  email:    process.env.MONITOR_USER_A_EMAIL    ?? 'monitor-a@g88.app',
  password: process.env.MONITOR_USER_A_PASSWORD ?? 'MonitorPass_A1!',
  displayName: 'Monitor A',
};
const USER_B = {
  email:    process.env.MONITOR_USER_B_EMAIL    ?? 'monitor-b@g88.app',
  password: process.env.MONITOR_USER_B_PASSWORD ?? 'MonitorPass_B1!',
  displayName: 'Monitor B',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const t0 = Date.now();
const elapsed = () => `+${Date.now() - t0}ms`;
let stepCount = 0;

function step(label) {
  stepCount++;
  console.log(`\n[${stepCount}] ${label}`);
}

function ok(label, detail = '') {
  console.log(`  ✓ ${label}${detail ? '  ' + detail : ''}`);
}

function fail(label, detail = '') {
  console.error(`  ✗ ${label}${detail ? '  ' + detail : ''}`);
  process.exit(1);
}

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

async function patch(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

/** Login; if 401 register (first run / reset). Returns { token, userId }. */
async function auth(user) {
  let res = await post('/auth/login', { email: user.email, password: user.password });
  if (res.status === 200) {
    ok(`login ${user.email}`, elapsed());
    return { token: res.body.tokens.accessToken, userId: res.body.user.id };
  }
  if (res.status === 401) {
    res = await post('/auth/register', {
      email: user.email,
      password: user.password,
      displayName: user.displayName,
    });
    if (res.status !== 201) fail(`register ${user.email}`, `HTTP ${res.status} ${JSON.stringify(res.body)}`);
    ok(`register ${user.email} (first run)`, elapsed());
    return { token: res.body.tokens.accessToken, userId: res.body.user.id };
  }
  fail(`auth ${user.email}`, `HTTP ${res.status}`);
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
      reject(new Error('Socket connect timeout'));
    }, 10_000);
    socket.on('connect', () => { clearTimeout(timer); resolve(socket); });
    socket.on('connect_error', (e) => { clearTimeout(timer); reject(e); });
  });
}

function socketSend(socket, conversationId, body, clientMessageId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 8_000);
    socket.emit('chat:send', { conversationId, body, clientMessageId }, (ack) => {
      clearTimeout(timer);
      resolve(ack?.ok ? ack.data : null);
    });
  });
}

/** Like socketSend but resolves the full ack ({ ok, code, ... }) so the caller
 *  can assert an expected rejection code (e.g. chat.request_pending). */
function socketSendAck(socket, conversationId, body, clientMessageId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, code: 'timeout' }), 8_000);
    socket.emit('chat:send', { conversationId, body, clientMessageId }, (ack) => {
      clearTimeout(timer);
      resolve(ack ?? { ok: false, code: 'no_ack' });
    });
  });
}

function joinConversation(socket, conversationId) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, code: 'timeout' }), 5_000);
    socket.emit('conversation:join', { conversationId }, (ack) => {
      clearTimeout(timer);
      resolve(ack ?? { ok: false, code: 'no_ack' });
    });
  });
}

// ─── Main ────────────────────────────────────────────────────────────────────

console.log(`G88 Synthetic Monitor — ${new Date().toISOString()}`);
console.log(`Target: ${BASE}\n`);

// ── Step 1: Auth ──────────────────────────────────────────────────────────────
step('Auth — login or register both monitor users');
const a = await auth(USER_A);
const b = await auth(USER_B);

// ── Step 2: Discovery ─────────────────────────────────────────────────────────
step('Discovery — POST /discovery/nearby');
const discoveryRes = await post('/discovery/nearby', {
  viewport: { ne: { lat: 52.54, lng: 13.42 }, sw: { lat: 52.50, lng: 13.38 } },
  zoom: 14,
}, a.token);
if (discoveryRes.status !== 200) fail('discovery', `HTTP ${discoveryRes.status}`);
if (!('viewportHash' in discoveryRes.body)) fail('discovery response missing viewportHash');
ok(`discovery`, `${discoveryRes.body.points?.length ?? 0} points  hash=${discoveryRes.body.viewportHash}  ${elapsed()}`);

// ── Step 3: Wave ──────────────────────────────────────────────────────────────
step('Wave — A → B, then B → A (or pick up existing conversation)');

let conversationId = null;

const waveA = await post('/interactions/wave', { toUserId: b.userId, context: 'map' }, a.token);
if (waveA.status === 201) {
  ok(`wave A→B`, `waveId=${waveA.body.id}  conversationId=${waveA.body.conversationId}`);
  conversationId = waveA.body.conversationId;
} else if (waveA.status === 409 && waveA.body?.code === 'wave.cooldown') {
  ok(`wave A→B`, 'cooldown (wave already sent within 24h — expected on repeat runs)');
} else {
  fail('wave A→B', `HTTP ${waveA.status} ${JSON.stringify(waveA.body)}`);
}

if (!conversationId) {
  // Reciprocal wave or pick up existing conversation.
  const waveB = await post('/interactions/wave', { toUserId: a.userId, context: 'map' }, b.token);
  if (waveB.status === 201) {
    ok(`wave B→A`, `waveId=${waveB.body.id}  conversationId=${waveB.body.conversationId}`);
    conversationId = waveB.body.conversationId;
  } else if (waveB.status === 409 && waveB.body?.code === 'wave.cooldown') {
    ok('wave B→A', 'cooldown');
  } else {
    fail('wave B→A', `HTTP ${waveB.status} ${JSON.stringify(waveB.body)}`);
  }
}

// If neither wave returned a conversationId, find an existing one.
if (!conversationId) {
  const convoRes = await get('/conversations', a.token);
  if (convoRes.status !== 200) fail('GET /conversations', `HTTP ${convoRes.status}`);
  const convos = convoRes.body ?? [];
  // Find a conversation that includes user B (participant_ids contains b.userId).
  const existing = convos.find((c) =>
    Array.isArray(c.participantIds)
      ? c.participantIds.includes(b.userId)
      : JSON.stringify(c).includes(b.userId),
  );
  if (existing) {
    conversationId = existing.id;
    ok('conversation', `found existing ${conversationId}`);
  } else {
    fail('conversation', 'no conversation between A and B — waves may not have reciprocated yet');
  }
}

// ── Step 4: Socket — connect both users ───────────────────────────────────────
step('Socket — connect A and B, send a message, assert delivery');

let socketA, socketB;
try {
  [socketA, socketB] = await Promise.all([
    connectSocket(a.token),
    connectSocket(b.token),
  ]);
  ok('socket A connected', `id=${socketA.id}  ${elapsed()}`);
  ok('socket B connected', `id=${socketB.id}`);
} catch (e) {
  fail('socket connect', e.message);
}

// Both users must join the conversation room before A can send.
async function joinConvo(socket, label) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, code: 'timeout' }), 5_000);
    socket.emit('conversation:join', { conversationId }, (ack) => {
      clearTimeout(timer);
      resolve(ack ?? { ok: false, code: 'no_ack' });
    });
  });
}

const joinA = await joinConvo(socketA, 'A');
if (!joinA.ok) fail('conversation:join A', JSON.stringify(joinA));
ok('conversation:join A');

const joinB = await joinConvo(socketB, 'B');
if (!joinB.ok) fail('conversation:join B', JSON.stringify(joinB));
ok('conversation:join B');

// Set up B's message listener before A sends.
const msgReceived = new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 10_000);
  socketB.on('chat:message', (msg) => {
    clearTimeout(timer);
    resolve(msg);
  });
});

// A sends a message.
const clientId = `monitor-${Date.now()}`;
const msgBody  = `synthetic check ${new Date().toISOString()}`;
const ack = await socketSend(socketA, conversationId, msgBody, clientId);
if (!ack) fail('chat:send ack', 'timeout or ok:false — check server logs');
ok('chat:send ack', `msgId=${ack.id}  ${elapsed()}`);

// Assert B received it.
const received = await msgReceived;
if (!received) fail('chat:message delivery to B', 'not received within 8s');
if (received.body !== msgBody) fail('chat:message body mismatch', `got "${received.body}"`);
ok('chat:message received by B', elapsed());

socketA.disconnect();
socketB.disconnect();

// ── Step 5: Interest-based message request ────────────────────────────────────
step('Message request — shared-interest gate, one-message cap, reply promotes');

const SHARED_TAG = 'synthetic-monitor';

// Fresh receiver each run: request→accept promotion is one-way, so a reused pair
// could only exercise the request path once. A throwaway user keeps it hermetic.
const reqUser = {
  email: `monitor-req-${Date.now()}@g88.app`,
  password: 'MonitorPass_R1!',
  displayName: 'Monitor Req',
};
const r = await auth(reqUser);

// Give A and R a common interest so the gate opens the request path.
const patchA = await patch('/users/me/profile', { interests: [SHARED_TAG] }, a.token);
if (patchA.status !== 200) fail('patch A interests', `HTTP ${patchA.status}`);
const patchR = await patch('/users/me/profile', { interests: [SHARED_TAG] }, r.token);
if (patchR.status !== 200) fail('patch R interests', `HTTP ${patchR.status}`);
ok('shared interest set', `A & R both like "${SHARED_TAG}"`);

// A views R's profile → relationship should offer a request, not a full chat.
const rel0 = await get(`/users/${r.userId}`, a.token);
if (rel0.status !== 200) fail('GET /users/:id (R)', `HTTP ${rel0.status}`);
const relationship0 = rel0.body?.relationship;
if (!relationship0) fail('relationship block missing on public profile');
if (relationship0.canMessage !== 'request') fail('expected canMessage=request', `got "${relationship0.canMessage}"`);
if (relationship0.matched !== false) fail('expected matched=false before any message');
if (!Array.isArray(relationship0.sharedInterests) || !relationship0.sharedInterests.includes(SHARED_TAG)) {
  fail('expected sharedInterests to include the tag', JSON.stringify(relationship0.sharedInterests));
}
ok('relationship = request', `sharedInterests=${JSON.stringify(relationship0.sharedInterests)}`);

// Open the request conversation.
const openRes = await post('/conversations', { targetUserId: r.userId }, a.token);
if (openRes.status !== 201) fail('POST /conversations', `HTTP ${openRes.status} ${JSON.stringify(openRes.body)}`);
if (openRes.body?.status !== 'pending' || openRes.body?.permission !== 'request') {
  fail('expected pending/request', JSON.stringify(openRes.body));
}
const reqConvoId = openRes.body.conversationId;
ok('request conversation opened', `id=${reqConvoId}  ${elapsed()}`);

// Sockets for A and R, both joined to the request room.
let socketReqA, socketReqR;
try {
  [socketReqA, socketReqR] = await Promise.all([connectSocket(a.token), connectSocket(r.token)]);
  ok('sockets connected (A, R)', elapsed());
} catch (e) {
  fail('socket connect (request flow)', e.message);
}

const jReqA = await joinConversation(socketReqA, reqConvoId);
if (!jReqA.ok) fail('conversation:join A (request)', JSON.stringify(jReqA));
const jReqR = await joinConversation(socketReqR, reqConvoId);
if (!jReqR.ok) fail('conversation:join R (request)', JSON.stringify(jReqR));
ok('both joined request conversation');

// A sends the single allowed request message.
const m1 = await socketSendAck(socketReqA, reqConvoId, 'request: hi from monitor', `req-${Date.now()}-1`);
if (!m1.ok) fail('first request message', JSON.stringify(m1));
ok('request message #1 sent', elapsed());

// A's SECOND message must be blocked by the one-message cap.
const m2 = await socketSendAck(socketReqA, reqConvoId, 'request: should be blocked', `req-${Date.now()}-2`);
if (m2.ok) fail('one-message cap', 'second message was accepted but should be blocked');
if (m2.code !== 'chat.request_pending') fail('expected chat.request_pending', `got "${m2.code}"`);
ok('one-message cap enforced', `code=${m2.code}`);

// R replies → promotes the conversation to accepted (A should receive it).
const replyReceived = new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), 10_000);
  socketReqA.on('chat:message', (msg) => {
    if (msg.senderId === r.userId) { clearTimeout(timer); resolve(msg); }
  });
});
const rReply = await socketSendAck(socketReqR, reqConvoId, 'reply: accepted!', `req-${Date.now()}-reply`);
if (!rReply.ok) fail('R reply', JSON.stringify(rReply));
if (!(await replyReceived)) fail('A did not receive R reply');
ok('R reply promotes request', elapsed());

// Relationship now reflects an accepted chat, and A can send freely.
const rel1 = await get(`/users/${r.userId}`, a.token);
if (rel1.body?.relationship?.canMessage !== 'chat') {
  fail('expected canMessage=chat after promotion', JSON.stringify(rel1.body?.relationship));
}
if (rel1.body?.relationship?.matched !== true) fail('expected matched=true after promotion');
ok('promotion confirmed', 'canMessage=chat, matched=true');

const m3 = await socketSendAck(socketReqA, reqConvoId, 'now unrestricted', `req-${Date.now()}-3`);
if (!m3.ok) fail('post-promotion send', JSON.stringify(m3));
ok('messaging unrestricted after promotion', elapsed());

socketReqA.disconnect();
socketReqR.disconnect();

// ─── Done ─────────────────────────────────────────────────────────────────────
console.log(`\n✅  All checks passed in ${Date.now() - t0}ms`);
