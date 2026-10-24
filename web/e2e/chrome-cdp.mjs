import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

export class CdpClient {
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

export async function launchChrome(prefix = 'nexa-chrome-e2e-') {
  const profileDir = await mkdtemp(join(tmpdir(), prefix));
  const debugPort = await reserveDebugPort();
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

  let errors = '';
  chrome.stderr?.on('data', (chunk) => {
    errors = `${errors}${String(chunk)}`.slice(-8_000);
  });

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

    const cdp = await CdpClient.connect(version.webSocketDebuggerUrl);
    return {
      cdp,
      chrome,
      profileDir,
      errors: () => errors,
    };
  } catch (error) {
    await stopChrome(chrome);
    await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    throw error;
  }
}

export async function createTab(cdp, url, readyExpression) {
  const created = await cdp.send('Target.createTarget', { url });
  const attached = await cdp.send('Target.attachToTarget', {
    targetId: created.targetId,
    flatten: true,
  });
  const sessionId = attached.sessionId;
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  if (readyExpression) {
    await waitFor(
      async () => (await evaluate(cdp, sessionId, readyExpression)) === true,
      3_000,
      'browser fixture initialization',
    );
  }
  return sessionId;
}

export async function evaluate(cdp, sessionId, expression) {
  const response = await cdp.send('Runtime.evaluate', {
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

export async function cleanupChrome(runtime) {
  runtime.cdp?.close();
  await stopChrome(runtime.chrome);
  await rm(runtime.profileDir, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}

export async function stopChrome(child) {
  if (child.exitCode != null || child.signalCode != null) return;
  const gracefulExit = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  const exited = await Promise.race([
    gracefulExit.then(() => true),
    delay(1_500).then(() => false),
  ]);
  if (exited || child.exitCode != null || child.signalCode != null) return;

  const forcedExit = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGKILL');
  await forcedExit;
}

export async function closeServer(server) {
  if (!server.listening) return;
  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function waitFor(task, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs;
  let lastValue = null;
  while (Date.now() < deadline) {
    lastValue = await task();
    if (lastValue) return lastValue;
    await delay(50);
  }
  throw new Error(`timed out waiting for ${label}; last value=${JSON.stringify(lastValue)}`);
}

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function reserveDebugPort() {
  const { createServer } = await import('node:net');
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('failed to reserve Chrome debug port');
  }
  const port = address.port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}
