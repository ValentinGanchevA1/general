import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import {
  assert,
  cleanupChrome,
  createTab,
  evaluate,
  launchChrome,
  waitFor,
} from './chrome-cdp.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const fixtureHtml = await readFile(join(here, 'realtime-fixture.html'), 'utf8');
const fixtureBuild = await build({
  entryPoints: [join(here, 'realtime-fixture.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  target: ['chrome120'],
  write: false,
  logLevel: 'silent',
  nodePaths: ['apps/admin/node_modules'],
});
const fixtureJs = fixtureBuild.outputFiles[0]?.text;
if (!fixtureJs) throw new Error('realtime fixture bundle was not produced');

const backendRequire = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { Server: SocketIOServer } = backendRequire('socket.io');

const handshakes = [];
const disconnects = [];
const joins = [];
const server = createServer((request, response) => {
  const parsed = new URL(request.url ?? '/', 'https://nexa.invalid');

  if (request.method === 'GET' && parsed.pathname === '/') {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(fixtureHtml);
    return;
  }

  if (request.method === 'GET' && parsed.pathname === '/realtime-fixture.js') {
    response.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    response.end(fixtureJs);
    return;
  }

  response.writeHead(404).end('Not Found');
});

const socketServer = new SocketIOServer(server, {
  transports: ['websocket', 'polling'],
  cors: { origin: true, credentials: true },
});
const realtimeNamespace = socketServer.of('/realtime');

realtimeNamespace.on('connection', (socket) => {
  const token = typeof socket.handshake.auth?.token === 'string'
    ? socket.handshake.auth.token
    : '';
  handshakes.push({ token, socketId: socket.id });

  socket.on('conversation:join', (payload, ack) => {
    const conversationId = typeof payload?.conversationId === 'string'
      ? payload.conversationId
      : '';
    joins.push({ token, socketId: socket.id, conversationId });
    void socket.join(`conversation:${conversationId}`);
    ack({ ok: true, data: { joined: true } });
  });

  socket.on('disconnect', (reason) => {
    disconnects.push({ token, socketId: socket.id, reason });
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});

const address = server.address();
if (!address || typeof address === 'string') throw new Error('failed to resolve realtime fixture server port');
const baseUrl = `http://127.0.0.1:${address.port}`;
const conversationId = '11111111-1111-4111-8111-111111111111';
const runtime = await launchChrome('nexa-realtime-e2e-');

try {
  const tab = await createTab(
    runtime.cdp,
    `${baseUrl}/`,
    "typeof window.nexaRealtimeE2E === 'object'",
  );

  await evaluate(
    runtime.cdp,
    tab,
    `window.nexaRealtimeE2E.connect('token-v1', '${conversationId}')`,
  );

  await waitFor(
    async () => handshakes.some((item) => item.token === 'token-v1'),
    4_000,
    'initial realtime handshake',
  );
  await waitFor(
    async () => joins.some((item) => item.token === 'token-v1' && item.conversationId === conversationId),
    4_000,
    'initial conversation join',
  );
  await waitFor(
    async () => (await snapshot(tab)).joinSuccesses === 1,
    4_000,
    'browser initial join acknowledgment',
  );

  await evaluate(runtime.cdp, tab, "window.nexaRealtimeE2E.rotateToken('token-v2')");

  await waitFor(
    async () => disconnects.some((item) => item.token === 'token-v1'),
    4_000,
    'old-token socket disconnect',
  );
  await waitFor(
    async () => handshakes.some((item) => item.token === 'token-v2'),
    4_000,
    'rotated-token realtime handshake',
  );
  await waitFor(
    async () => joins.some((item) => item.token === 'token-v2' && item.conversationId === conversationId),
    4_000,
    'conversation rejoin after token rotation',
  );
  await waitFor(
    async () => (await snapshot(tab)).joinSuccesses === 2,
    4_000,
    'browser rejoin acknowledgment',
  );

  const firstHandshake = handshakes.find((item) => item.token === 'token-v1');
  const secondHandshake = handshakes.find((item) => item.token === 'token-v2');
  assert(firstHandshake?.socketId !== secondHandshake?.socketId, 'token rotation reused the old server socket');

  const browserAfterReconnect = await snapshot(tab);
  assert(
    JSON.stringify(browserAfterReconnect.connectionStates.slice(-3)) === JSON.stringify([true, false, true]),
    `unexpected connection lifecycle: ${JSON.stringify(browserAfterReconnect.connectionStates)}`,
  );
  assert(browserAfterReconnect.errors.length === 0, `realtime client reported errors: ${JSON.stringify(browserAfterReconnect.errors)}`);

  const message = {
    id: '22222222-2222-4222-8222-222222222222',
    conversationId,
    senderId: '33333333-3333-4333-8333-333333333333',
    body: 'after-rotation',
    type: 'text',
    createdAt: new Date().toISOString(),
  };
  realtimeNamespace.to(`conversation:${conversationId}`).emit('chat:message', message);

  await waitFor(
    async () => (await snapshot(tab)).messages.some((item) => item.id === message.id),
    3_000,
    'chat message after room rejoin',
  );
  const finalSnapshot = await snapshot(tab);
  const received = finalSnapshot.messages.find((item) => item.id === message.id);
  assert(received?.body === 'after-rotation', 'post-rotation room message payload was not delivered');

  await evaluate(runtime.cdp, tab, 'window.nexaRealtimeE2E.disconnect()');

  console.log('NEXA realtime E2E passed: token-v1 join, token-v2 reconnect, automatic room rejoin, post-rotation message delivery.');
} catch (error) {
  const chromeErrors = runtime.errors();
  if (chromeErrors) console.error(chromeErrors);
  throw error;
} finally {
  await cleanupChrome(runtime);
  await new Promise((resolve) => socketServer.close(resolve));
}

async function snapshot(tab) {
  return await evaluate(runtime.cdp, tab, 'window.nexaRealtimeE2E.snapshot()');
}
