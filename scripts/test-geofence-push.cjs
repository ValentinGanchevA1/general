// End-to-end test: geofence-triggered alert push.
//
// 1. Register the emulator's real FCM token under monitor-a
// 2. monitor-a heartbeats at Varna → sets their location
// 3. monitor-a creates a geofence anchored at that location
// 4. monitor-b heartbeats at the SAME location
// 5. monitor-b posts an alert → push should fire to monitor-a's tokens
//    (which now include the emulator's real device token)
//
// usage: node test-geofence-push.cjs <real-fcm-token>
const { io } = require('../apps/mobile/node_modules/socket.io-client');

const BASE = 'https://g88-api.onrender.com';
const API = `${BASE}/api/v1`;
const FCM_TOKEN = process.argv[2];
if (!FCM_TOKEN) { console.error('usage: node test-geofence-push.cjs <fcm-token>'); process.exit(1); }

// Varna city centre — both users heartbeat here so they share an r7 cell.
const LAT = 43.2141, LNG = 27.9147;

const A = { email: 'monitor-a@g88.app', password: 'MonitorPass_A1!' };
const B = { email: 'monitor-b@g88.app', password: 'MonitorPass_B1!' };

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function login(u) {
  const r = await post('/auth/login', { email: u.email, password: u.password });
  if (r.status !== 200) throw new Error(`login ${u.email}: ${r.status}`);
  return { token: r.body.tokens.accessToken, userId: r.body.user.id };
}

function heartbeat(token) {
  return new Promise((resolve, reject) => {
    const s = io(`${BASE}/realtime`, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 10000 });
    const giveUp = setTimeout(() => { s.disconnect(); reject(new Error('hb timeout')); }, 12000);
    s.on('connect', () => {
      s.emit('presence:update', { location: { lat: LAT, lng: LNG } }, (ack) => {
        clearTimeout(giveUp);
        s.disconnect();
        ack?.ok ? resolve(ack.data) : reject(new Error('presence ' + JSON.stringify(ack)));
      });
    });
    s.on('connect_error', (e) => { clearTimeout(giveUp); reject(e); });
  });
}

(async () => {
  console.log('1. login A + B');
  const a = await login(A);
  const b = await login(B);
  console.log(`   A=${a.userId.slice(0,8)} B=${b.userId.slice(0,8)}`);

  console.log('2. register real FCM token under A');
  const reg = await post('/notifications/device-token', { token: FCM_TOKEN, platform: 'android' }, a.token);
  console.log('   device-token →', reg.status);

  console.log('3. A heartbeat @ Varna');
  const hbA = await heartbeat(a.token);
  console.log('   A cell r8 =', hbA.cellId);

  console.log('4. A creates geofence (radius 1)');
  const gf = await post('/geofences', { label: 'test-area', radiusRings: 1 }, a.token);
  console.log('   geofence →', gf.status, gf.body?.centerH3R7 ?? gf.body);

  console.log('5. B heartbeat @ same Varna spot');
  const hbB = await heartbeat(b.token);
  console.log('   B cell r8 =', hbB.cellId);

  console.log('6. B posts an alert (should push to A → emulator)');
  const alert = await post('/alerts', { category: 'food', body: 'Geofence push test ' + new Date().toISOString().slice(11,19) }, b.token);
  console.log('   alert →', alert.status, alert.body?.id ?? alert.body);

  console.log('\nDone. Watch the emulator notification tray.');
  process.exit(0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
