import { existsSync } from 'node:fs';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (typeof message.id !== 'number') return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message ?? 'CDP command failed'));
      else pending.resolve(message.result ?? {});
    });

    socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('CDP socket closed'));
      this.pending.clear();
    });
  }

  static async connect(url) {
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve, { once: true });
      socket.addEventListener('error', reject, { once: true });
    });
    return new CdpClient(socket);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.nextId;
    const message = { id, method, params };
    if (sessionId) message.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify(message));
    });
  }

  close() {
    this.socket.close();
  }
}

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
const profileDir = await mkdtemp(join(tmpdir(), 'nexa-chrome-e2e-'));
const debugPort = 9223;
const chromePath = findChrome();
const chrome = spawn(chromePath, [
  '--headless=new',
  '--no-sandbox',
  '--disable-gpu',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  `--remote-debugging-port=${debugPort}`,
  '--remote-debugging-address=127.0.0.1',
  `--user-data-dir=${profileDir}`,
  'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

let chromeErrors = '';
chrome.stderr?.on('data', (chunk) => {
  chromeErrors = `${chromeErrors}${String(chunk)}`.slice(-8_000);
});

let cdp;
try {
  const version = await waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }, 12_000, 'Chrome DevTools endpoint');

  if (typeof version.webSocketDebuggerUrl !== 'string') {
    throw new Error('Chrome did not expose a DevTools WebSocket URL');
  }

  cdp = await CdpClient.connect(version.webSocketDebuggerUrl);
  const tabA = await createTab(cdp, `${baseUrl}/`);
  const tabB = await createTab(cdp, `${baseUrl}/`);

  assert(await evaluate(cdp, tabA, 'window.nexaE2E.lockSupported') === true, 'Web Locks unavailable in tab A');
  assert(await evaluate(cdp, tabB, 'window.nexaE2E.lockSupported') === true, 'Web Locks unavailable in tab B');

  await evaluate(cdp, tabA, 'window.nexaE2E.seed()');
  assert(await evaluate(cdp, tabA, 'document.cookie') === '', 'HttpOnly refresh cookie became JS-readable');

  // Control: the mock server consumes the refresh credential at request start.
  // Two unlocked tabs therefore race and one must be detected as a replay.
  const unlocked = await Promise.all([
    evaluate(cdp, tabA, 'window.nexaE2E.rotateUnlocked()'),
    evaluate(cdp, tabB, 'window.nexaE2E.rotateUnlocked()'),
  ]);
  const unlockedStatuses = unlocked.map((item) => item.status).sort((a, b) => a - b);
  assert(
    JSON.stringify(unlockedStatuses) === JSON.stringify([200, 409]),
    `unlocked control did not reproduce replay race: ${JSON.stringify(unlocked)}`,
  );
  const unlockedStats = await readStats();
  assert(unlockedStats.replayCount === 1, `expected one replay in control, got ${unlockedStats.replayCount}`);

  // Actual contract: the same two tabs share the HttpOnly cookie, but the Web
  // Lock serializes rotations so the second request observes the rotated cookie.
  await evaluate(cdp, tabA, 'window.nexaE2E.seed()');
  const locked = await Promise.all([
    evaluate(cdp, tabA, 'window.nexaE2E.rotateLocked()'),
    evaluate(cdp, tabB, 'window.nexaE2E.rotateLocked()'),
  ]);
  assert(locked.every((item) => item.status === 200), `locked rotations were not both successful: ${JSON.stringify(locked)}`);
  const lockedStats = await readStats();
  assert(lockedStats.replayCount === 0, `Web Lock allowed a refresh replay: ${JSON.stringify(lockedStats)}`);
  assert(lockedStats.version === 2, `expected two serialized rotations, got ${lockedStats.version}`);

  // BroadcastChannel carries only a session-change signal. The receiver writes
  // a short-lived sessionStorage marker; after reload that marker suppresses one
  // outbound signal, preventing a reload/broadcast loop.
  await evaluate(cdp, tabA, 'window.nexaE2E.broadcast()');
  await waitFor(
    async () => (await evaluate(cdp, tabB, 'window.nexaE2E.signalCount')) === 1,
    2_000,
    'remote session signal in tab B',
  );
  assert(
    await evaluate(cdp, tabB, "sessionStorage.getItem('nexa.web.auth.remote-reload')") === '1',
    'remote reload marker was not set',
  );

  await cdp.send('Page.reload', { ignoreCache: true }, tabB);
  await waitFor(
    async () => (
      await evaluate(
        cdp,
        tabB,
        "typeof window.nexaE2E === 'object' && sessionStorage.getItem('nexa.web.auth.remote-reload') === null",
      )
    ) === true,
    3_000,
    'tab B reload and marker consumption',
  );

  await evaluate(cdp, tabB, 'window.nexaE2E.broadcast()');
  await delay(150);
  assert(await evaluate(cdp, tabA, 'window.nexaE2E.signalCount') === 0, 'reload-loop suppression failed');

  await evaluate(cdp, tabB, 'window.nexaE2E.broadcast()');
  await waitFor(
    async () => (await evaluate(cdp, tabA, 'window.nexaE2E.signalCount')) === 1,
    2_000,
    'session signal in tab A after suppression clears',
  );

  assert(await evaluate(cdp, tabA, 'localStorage.length') === 0, 'auth fixture persisted data in localStorage');

  console.log('NEXA multitab auth E2E passed: replay control, Web Lock serialization, HttpOnly cookie, BroadcastChannel propagation.');
} catch (error) {
  if (chrome.exitCode != null && chromeErrors) console.error(chromeErrors);
  throw error;
} finally {
  cdp?.close();
  await stopChrome(chrome);
  await closeServer(server);
  await rm(profileDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
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

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Chrome/Chromium not found; set CHROME_PATH');
  return found;
}

async function createTab(cdpClient, url) {
  const created = await cdpClient.send('Target.createTarget', { url });
  const attached = await cdpClient.send('Target.attachToTarget', {
    targetId: created.targetId,
    flatten: true,
  });
  const sessionId = attached.sessionId;
  await cdpClient.send('Runtime.enable', {}, sessionId);
  await cdpClient.send('Page.enable', {}, sessionId);
  await waitFor(
    async () => (await evaluate(cdpClient, sessionId, "typeof window.nexaE2E === 'object'")) === true,
    3_000,
    'fixture initialization',
  );
  return sessionId;
}

async function evaluate(cdpClient, sessionId, expression) {
  const response = await cdpClient.send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  }, sessionId);
  if (response.exceptionDetails) {
    const description = response.exceptionDetails.exception?.description ?? response.exceptionDetails.text;
    throw new Error(`browser evaluation failed: ${description}`);
  }
  return response.result?.value;
}

async function stopChrome(child) {
  if (child.exitCode != null || child.signalCode != null) return;

  const waitForExit = () => new Promise((resolve) => child.once('exit', resolve));
  const gracefulExit = waitForExit();
  child.kill('SIGTERM');
  const exited = await Promise.race([
    gracefulExit.then(() => true),
    delay(1_500).then(() => false),
  ]);
  if (exited || child.exitCode != null || child.signalCode != null) return;

  const forcedExit = waitForExit();
  child.kill('SIGKILL');
  await forcedExit;
}

async function closeServer(httpServer) {
  if (!httpServer.listening) return;
  await new Promise((resolve, reject) => {
    httpServer.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function waitFor(task, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await task();
    if (lastValue) return lastValue;
    await delay(50);
  }
  throw new Error(`timed out waiting for ${label}; last value=${JSON.stringify(lastValue)}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
