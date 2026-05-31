// One-shot Socket.IO integration test against the production realtime gateway.
// Usage: node scripts/test-socket.mjs
import pkg from '../apps/mobile/node_modules/socket.io-client/dist/socket.io.esm.min.js';
const { io } = pkg;

const BASE = 'https://g88-api.onrender.com';
const API  = `${BASE}/api/v1`;

// ── 1. Get a fresh access token ───────────────────────────────────────────────
const loginRes = await fetch(`${API}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'test-ci@g88.app', password: 'TestPass123!' }),
});
const { tokens } = await loginRes.json();
const token = tokens.accessToken;
console.log('[auth]   login OK, token acquired');

// ── 2. Connect to /realtime namespace ─────────────────────────────────────────
const socket = io(`${BASE}/realtime`, {
  auth: { token },
  transports: ['websocket'],
  reconnection: false,
  timeout: 10_000,
});

const results = [];

function pass(label) { results.push(`  ✓ ${label}`); }
function fail(label, err) { results.push(`  ✗ ${label}: ${err}`); }

await new Promise((resolve) => {
  const timer = setTimeout(() => {
    fail('timeout', 'no connect/error within 10s');
    resolve();
  }, 10_000);

  socket.on('connect', () => {
    pass(`connected  id=${socket.id}`);

    // ── 3. Send presence:update ───────────────────────────────────────────────
    socket.emit(
      'presence:update',
      { lat: 52.52, lng: 13.405, accuracy: 10 },
      (ack) => {
        if (ack?.ok) pass('presence:update ack ok');
        else fail('presence:update', JSON.stringify(ack));
      },
    );

    // Give events 3s to settle then disconnect
    setTimeout(() => {
      clearTimeout(timer);
      socket.disconnect();
      resolve();
    }, 3_000);
  });

  socket.on('connect_error', (err) => {
    fail('connect', err.message);
    clearTimeout(timer);
    resolve();
  });
});

// ── 4. Print results ──────────────────────────────────────────────────────────
console.log('\n[socket] Results:');
results.forEach((r) => console.log(r));
const failed = results.filter((r) => r.startsWith('  ✗'));
process.exit(failed.length ? 1 : 0);
