// One-shot Socket.IO integration test against the production realtime gateway.
// Usage: node scripts/test-socket.cjs
'use strict';

const { io } = require('../apps/mobile/node_modules/socket.io-client');

const BASE = 'https://g88-api.onrender.com';
const API  = `${BASE}/api/v1`;

async function main() {
  // 1. Get a fresh token
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'test-ci@g88.app', password: 'TestPass123!' }),
  });
  const { tokens } = await loginRes.json();
  const token = tokens.accessToken;
  console.log('[auth]   login OK');

  // 2. Connect to /realtime
  const socket = io(`${BASE}/realtime`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: false,
    timeout: 10_000,
  });

  const results = [];
  const pass = (label) => { console.log(`  ✓ ${label}`); results.push(true); };
  const fail = (label, err) => { console.log(`  ✗ ${label}: ${err}`); results.push(false); };

  await new Promise((resolve) => {
    const giveUp = setTimeout(() => { fail('timeout', 'no response within 10s'); resolve(); }, 10_000);

    socket.on('connect', () => {
      pass(`connected  id=${socket.id}`);

      // 3. presence:update with ack
      console.log('  → emitting presence:update ...');
      socket.emit('presence:update', { location: { lat: 52.52, lng: 13.405 } }, (ack) => {
        console.log('  ← ack received:', JSON.stringify(ack));
        if (ack?.ok) pass(`presence:update ack ok  cellId=${ack.data?.cellId}`);
        else fail('presence:update', JSON.stringify(ack));
      });

      // 4. Disconnect cleanly after 8s
      setTimeout(() => {
        clearTimeout(giveUp);
        socket.disconnect();
        resolve();
      }, 8_000);
    });

    socket.on('disconnect', (reason) => {
      console.log(`  ⚡ disconnected: ${reason}`);
    });

    socket.on('connect_error', (err) => {
      fail('connect', err.message);
      clearTimeout(giveUp);
      resolve();
    });
  });

  const failed = results.filter((r) => !r).length;
  console.log(`\n[socket] ${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
