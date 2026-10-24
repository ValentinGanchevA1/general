import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import {
  assert,
  cleanupChrome,
  closeServer,
  createTab,
  delay,
  evaluate,
  launchChrome,
  waitFor,
} from './chrome-cdp.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const fixtureHtml = await readFile(join(here, 'session-fixture.html'), 'utf8');
const fixtureBuild = await build({
  entryPoints: [join(here, 'session-fixture.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  write: false,
  logLevel: 'silent',
});
const fixtureJs = fixtureBuild.outputFiles[0]?.text;
if (!fixtureJs) throw new Error('fixture bundle was not produced');

const state = {
  currentRefresh: 'r0',
  version: 0,
  replayCount: 0,
  requestCount: 0,
};

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'unknown' }));
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
if (!address || typeof address === 'string') throw new Error('failed to resolve fixture server port');
const baseUrl = `http://127.0.0.1:${address.port}`;
const runtime = await launchChrome('nexa-auth-e2e-');

try {
  const tabA = await createTab(runtime.cdp, `${baseUrl}/`, "typeof window.nexaE2E === 'object'");
  const tabB = await createTab(runtime.cdp, `${baseUrl}/`, "typeof window.nexaE2E === 'object'");

  assert(await evaluate(runtime.cdp, tabA, 'window.nexaE2E.lockSupported') === true, 'Web Locks unavailable in tab A');
  assert(await evaluate(runtime.cdp, tabB, 'window.nexaE2E.lockSupported') === true, 'Web Locks unavailable in tab B');

  await evaluate(runtime.cdp, tabA, 'window.nexaE2E.seed()');
  assert(await evaluate(runtime.cdp, tabA, 'document.cookie') === '', 'HttpOnly refresh cookie became JS-readable');

  const unlocked = await Promise.all([
    evaluate(runtime.cdp, tabA, 'window.nexaE2E.rotateUnlocked()'),
    evaluate(runtime.cdp, tabB, 'window.nexaE2E.rotateUnlocked()'),
  ]);
  const unlockedStatuses = unlocked.map((item) => item.status).sort((a, b) => a - b);
  assert(
    JSON.stringify(unlockedStatuses) === JSON.stringify([200, 409]),
    `unlocked control did not reproduce replay race: ${JSON.stringify(unlocked)}`,
  );
  const unlockedStats = await readStats();
  assert(unlockedStats.replayCount === 1, `expected one replay in control, got ${unlockedStats.replayCount}`);

  await evaluate(runtime.cdp, tabA, 'window.nexaE2E.seed()');
  const locked = await Promise.all([
    evaluate(runtime.cdp, tabA, 'window.nexaE2E.rotateLocked()'),
    evaluate(runtime.cdp, tabB, 'window.nexaE2E.rotateLocked()'),
  ]);
  assert(locked.every((item) => item.status === 200), `locked rotations were not both successful: ${JSON.stringify(locked)}`);
  const lockedStats = await readStats();
  assert(lockedStats.replayCount === 0, `Web Lock allowed a refresh replay: ${JSON.stringify(lockedStats)}`);
  assert(lockedStats.version === 2, `expected two serialized rotations, got ${lockedStats.version}`);

  await evaluate(runtime.cdp, tabA, 'window.nexaE2E.broadcast()');
  await waitFor(
    async () => (await evaluate(runtime.cdp, tabB, 'window.nexaE2E.signalCount')) === 1,
    2_000,
    'remote session signal in tab B',
  );
  assert(
    await evaluate(runtime.cdp, tabB, "sessionStorage.getItem('nexa.web.auth.remote-reload')") === '1',
    'remote reload marker was not set',
  );

  await runtime.cdp.send('Page.reload', { ignoreCache: true }, tabB);
  await waitFor(
    async () => (
      await evaluate(
        runtime.cdp,
        tabB,
        "typeof window.nexaE2E === 'object' && sessionStorage.getItem('nexa.web.auth.remote-reload') === null",
      )
    ) === true,
    3_000,
    'tab B reload and marker consumption',
  );

  await evaluate(runtime.cdp, tabB, 'window.nexaE2E.broadcast()');
  await delay(150);
  assert(await evaluate(runtime.cdp, tabA, 'window.nexaE2E.signalCount') === 0, 'reload-loop suppression failed');

  await evaluate(runtime.cdp, tabB, 'window.nexaE2E.broadcast()');
  await waitFor(
    async () => (await evaluate(runtime.cdp, tabA, 'window.nexaE2E.signalCount')) === 1,
    2_000,
    'session signal in tab A after suppression clears',
  );

  assert(await evaluate(runtime.cdp, tabA, 'localStorage.length') === 0, 'auth fixture persisted data in localStorage');
  console.log('NEXA multitab auth E2E passed: replay control, Web Lock serialization, HttpOnly cookie, BroadcastChannel propagation.');
} catch (error) {
  const chromeErrors = runtime.errors();
  if (chromeErrors) console.error(chromeErrors);
  throw error;
} finally {
  await cleanupChrome(runtime);
  await closeServer(server);
}

async function handleRequest(request, response) {
  const parsed = new URL(request.url ?? '/', 'https://nexa.invalid');

  if (request.method === 'GET' && parsed.pathname === '/') {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(fixtureHtml);
    return;
  }

  if (request.method === 'GET' && parsed.pathname === '/fixture.js') {
    response.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(fixtureJs);
    return;
  }

  if (request.method === 'POST' && parsed.pathname === '/seed') {
    state.currentRefresh = 'r0';
    state.version = 0;
    state.replayCount = 0;
    state.requestCount = 0;
    sendJson(response, 200, { ok: true }, 'r0');
    return;
  }

  if (request.method === 'POST' && parsed.pathname === '/rotate') {
    state.requestCount += 1;
    const supplied = readCookie(request.headers.cookie, 'nexa_test_refresh');
    if (supplied !== state.currentRefresh) {
      state.replayCount += 1;
      sendJson(response, 409, { ok: false, version: state.version });
      return;
    }

    state.version += 1;
    state.currentRefresh = `r${state.version}`;
    const version = state.version;
    const nextRefresh = state.currentRefresh;
    await delay(500);
    sendJson(response, 200, { ok: true, version }, nextRefresh);
    return;
  }

  if (request.method === 'GET' && parsed.pathname === '/stats') {
    sendJson(response, 200, state);
    return;
  }

  response.writeHead(404).end('Not Found');
}

function sendJson(response, statusCode, payload, refreshToken) {
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };
  if (refreshToken) {
    headers['Set-Cookie'] = `nexa_test_refresh=${refreshToken}; HttpOnly; SameSite=Lax; Path=/`;
  }
  response.writeHead(statusCode, headers);
  response.end(JSON.stringify(payload));
}

function readCookie(header, name) {
  if (typeof header !== 'string') return null;
  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return part.slice(separator + 1).trim();
  }
  return null;
}

async function readStats() {
  const response = await fetch(`${baseUrl}/stats`);
  if (!response.ok) throw new Error(`stats request failed: ${response.status}`);
  return await response.json();
}
