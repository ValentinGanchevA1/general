// E2E test for gamification: XP award, daily cap, streak.
// Uses a fresh throwaway account so counters start at zero.
const { io } = require('../apps/mobile/node_modules/socket.io-client');

const BASE = 'https://g88-api.onrender.com';
const API = `${BASE}/api/v1`;
const LAT = 43.2141, LNG = 27.9147;

async function http(method, path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

function heartbeat(token) {
  return new Promise((resolve, reject) => {
    const s = io(`${BASE}/realtime`, { auth: { token }, transports: ['websocket'], reconnection: false, timeout: 10000 });
    const t = setTimeout(() => { s.disconnect(); reject(new Error('hb timeout')); }, 12000);
    s.on('connect', () => s.emit('presence:update', { location: { lat: LAT, lng: LNG } }, (ack) => {
      clearTimeout(t); s.disconnect(); ack?.ok ? resolve() : reject(new Error('presence ' + JSON.stringify(ack)));
    }));
    s.on('connect_error', (e) => { clearTimeout(t); reject(e); });
  });
}

let pass = 0, fail = 0;
const check = (label, cond, detail = '') => {
  console.log(`  ${cond ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`);
  cond ? pass++ : fail++;
};

(async () => {
  const email = `gam-${Date.now()}@g88.app`;
  console.log('1. register fresh user', email);
  const reg = await http('POST', '/auth/register', { email, password: 'GamTest123!', displayName: 'Gam Test' });
  if (reg.status !== 201) throw new Error('register ' + reg.status);
  const token = reg.body.tokens.accessToken;

  console.log('2. baseline GET /gamification/me');
  let me = await http('GET', '/gamification/me', null, token);
  check('200', me.status === 200);
  check('level 1', me.body.level === 1, `level=${me.body.level}`);
  check('0 XP', me.body.totalXp === 0, `xp=${me.body.totalXp}`);
  check('streak 0', me.body.currentStreak === 0);

  console.log('3. ping → streak advances to 1');
  const ping = await http('POST', '/gamification/ping', null, token);
  check('ping 200', ping.status === 200);
  check('streak 1', ping.body.currentStreak === 1, `streak=${ping.body.currentStreak}`);
  const ping2 = await http('POST', '/gamification/ping', null, token);
  check('same-day ping stays 1', ping2.body.currentStreak === 1, `streak=${ping2.body.currentStreak}`);

  console.log('4. heartbeat (set location for alerts)');
  await heartbeat(token);

  console.log('5. post 4 alerts (cap is 3/day → expect 60 XP)');
  for (let i = 1; i <= 4; i++) {
    const a = await http('POST', '/alerts', { category: 'general', body: `gam test alert ${i}` }, token);
    check(`alert ${i} → 201`, a.status === 201, `status=${a.status}`);
  }
  // award is fire-and-forget; give it a moment to settle.
  await new Promise((r) => setTimeout(r, 2000));

  me = await http('GET', '/gamification/me', null, token);
  check('XP capped at 60 (3×20)', me.body.totalXp === 60, `xp=${me.body.totalXp}`);
  check('level 2 at 60 XP', me.body.level === 2, `level=${me.body.level}`); // L2 needs 50 XP
  check('xpIntoLevel correct', me.body.xpIntoLevel === 10, `into=${me.body.xpIntoLevel}`); // 60-50

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
