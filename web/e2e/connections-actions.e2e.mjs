import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import {
  assert,
  cleanupChrome,
  createTab,
  delay,
  evaluate,
  launchChrome,
  waitFor,
} from './chrome-cdp.mjs';

const [styles, mapStyles, connectionStyles] = await Promise.all([
  readFile('web/styles.css', 'utf8'),
  readFile('web/map.css', 'utf8'),
  readFile('web/connections.css', 'utf8'),
]);

const appBuild = await build({
  entryPoints: ['web/src/app.ts'],
  bundle: true,
  platform: 'browser',
  format: 'esm',
  target: ['chrome120'],
  write: false,
  logLevel: 'silent',
  nodePaths: ['apps/admin/node_modules'],
});
const appJs = appBuild.outputFiles[0]?.text;
if (!appJs) throw new Error('web app bundle was not produced');

const html = `<!doctype html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>NEXA Connections E2E</title>
  <link rel="stylesheet" href="/styles.css">
  <link rel="stylesheet" href="/map.css">
  <link rel="stylesheet" href="/connections.css">
  <style>#nexa-map,.slippy-surface{min-height:320px}</style>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>`;

const USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PEER_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const REQUEST_ID = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const WAVE_USER_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CONVERSATION_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const INITIAL_MESSAGE_ID = '11111111-1111-4111-8111-111111111111';
const OUTGOING_MESSAGE_ID = '22222222-2222-4222-8222-222222222222';
const PEER_MESSAGE_ID = '33333333-3333-4333-8333-333333333333';

const state = {
  acceptedFriend: false,
  wavedBack: false,
  waveBody: null,
  readMarked: false,
  joinedConversation: null,
  sentBodies: [],
  handshakeTokens: [],
};

const backendRequire = createRequire(new URL('../../apps/backend/package.json', import.meta.url));
const { Server: SocketIOServer } = backendRequire('socket.io');

const server = createServer((request, response) => {
  void handleRequest(request, response).catch((error) => {
    if (response.headersSent || response.destroyed) return;
    sendJson(response, 500, { error: error instanceof Error ? error.message : 'unknown' });
  });
});

const socketServer = new SocketIOServer(server, {
  transports: ['websocket', 'polling'],
  cors: { origin: true, credentials: true },
});

socketServer.of('/realtime').on('connection', (socket) => {
  const token = socket.handshake.auth?.token;
  state.handshakeTokens.push(typeof token === 'string' ? token : '');

  socket.on('conversation:join', (payload, ack) => {
    state.joinedConversation = payload?.conversationId ?? null;
    if (payload?.conversationId === CONVERSATION_ID) {
      void socket.join(CONVERSATION_ID);
      ack({ ok: true, data: { joined: true } });
      return;
    }
    ack({ ok: false, code: 'conversation.invalid', message: 'Invalid conversation' });
  });

  socket.on('chat:send', (payload, ack) => {
    state.sentBodies.push(payload?.body ?? '');
    const outgoing = {
      id: OUTGOING_MESSAGE_ID,
      conversationId: CONVERSATION_ID,
      senderId: USER_ID,
      body: payload?.body ?? '',
      type: 'text',
      createdAt: new Date().toISOString(),
    };

    // Deliver the same message through both ack and event to verify the UI's
    // id-based dedupe, then send a distinct peer reply through realtime.
    socket.emit('chat:message', outgoing);
    ack({ ok: true, data: outgoing });
    setTimeout(() => {
      socket.emit('chat:message', {
        id: PEER_MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderId: PEER_ID,
        body: 'Reply from peer',
        type: 'text',
        createdAt: new Date(Date.now() + 10).toISOString(),
      });
    }, 80);
  });
});

await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', resolve);
});
const address = server.address();
if (!address || typeof address === 'string') throw new Error('failed to resolve Connections fixture port');
const baseUrl = `http://127.0.0.1:${address.port}`;
const runtime = await launchChrome('nexa-connections-e2e-');

try {
  const tab = await createTab(runtime.cdp, `${baseUrl}/`, "document.querySelector('[data-tab=\"connections\"]') !== null");

  await waitFor(
    () => state.handshakeTokens.includes('connections-e2e-token'),
    4_000,
    'authenticated realtime handshake',
  );

  await evaluate(runtime.cdp, tab, "document.querySelector('[data-tab=\"connections\"]')?.click()");
  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "document.querySelector('[data-action=\"accept-friend\"]') !== null && document.querySelector('[data-action=\"wave-back\"]') !== null"),
    4_000,
    'actionable Connections rows',
  );

  await evaluate(runtime.cdp, tab, "document.querySelector('[data-action=\"accept-friend\"]')?.click()");
  await waitFor(() => state.acceptedFriend, 3_000, 'friend accept request');
  assert(
    await evaluate(runtime.cdp, tab, "document.body.textContent.includes('Friend request accepted.')"),
    'friend accept confirmation was not surfaced in the UI',
  );

  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "document.querySelector('[data-action=\"wave-back\"]') !== null"),
    2_000,
    'wave action after friend refresh',
  );
  await evaluate(runtime.cdp, tab, "document.querySelector('[data-action=\"wave-back\"]')?.click()");
  await waitFor(() => state.wavedBack, 3_000, 'wave-back request');
  assert(
    state.waveBody?.toUserId === WAVE_USER_ID && state.waveBody?.context === 'profile',
    `unexpected wave payload: ${JSON.stringify(state.waveBody)}`,
  );

  await waitFor(
    async () => await evaluate(runtime.cdp, tab, `document.querySelector('[data-conversation-id="${CONVERSATION_ID}"]') !== null`),
    2_000,
    'conversation row',
  );
  await evaluate(runtime.cdp, tab, `document.querySelector('[data-conversation-id="${CONVERSATION_ID}"]')?.click()`);

  await waitFor(() => state.readMarked, 3_000, 'conversation read marker');
  await waitFor(() => state.joinedConversation === CONVERSATION_ID, 3_000, 'conversation room join');
  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "document.querySelector('#chat-input')?.disabled === false"),
    3_000,
    'chat composer enable after room join',
  );
  assert(
    await evaluate(runtime.cdp, tab, "document.body.textContent.includes('Initial peer message')"),
    'initial REST chat history did not render',
  );

  await evaluate(runtime.cdp, tab, `(() => {
    const input = document.querySelector('#chat-input');
    const form = document.querySelector('#chat-composer');
    if (!(input instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) throw new Error('chat composer missing');
    input.value = 'Hello from browser';
    form.requestSubmit();
  })()`);

  await waitFor(() => state.sentBodies.includes('Hello from browser'), 3_000, 'realtime chat send');
  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "[...document.querySelectorAll('.message.mine p')].filter((node) => node.textContent === 'Hello from browser').length === 1"),
    3_000,
    'deduplicated outgoing message',
  );
  await waitFor(
    async () => await evaluate(runtime.cdp, tab, "[...document.querySelectorAll('.message.peer p')].some((node) => node.textContent === 'Reply from peer')"),
    3_000,
    'peer realtime reply',
  );

  await delay(200);
  assert(
    await evaluate(runtime.cdp, tab, "[...document.querySelectorAll('.message.mine p')].filter((node) => node.textContent === 'Hello from browser').length === 1"),
    'ack + chat:message duplicate rendered the outgoing message twice',
  );

  console.log('NEXA Connections E2E passed: friend accept, wave-back, history/read, room join, chat send, event dedupe and peer receive.');
} catch (error) {
  const chromeErrors = runtime.errors();
  if (chromeErrors) console.error(chromeErrors);
  throw error;
} finally {
  await cleanupChrome(runtime);
  await new Promise((resolve) => socketServer.close(resolve));
}

async function handleRequest(request, response) {
  const parsed = new URL(request.url ?? '/', 'https://nexa.invalid');

  if (request.method === 'GET' && parsed.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(html);
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/app.js') {
    response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(appJs);
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/styles.css') return sendCss(response, styles);
  if (request.method === 'GET' && parsed.pathname === '/map.css') return sendCss(response, mapStyles);
  if (request.method === 'GET' && parsed.pathname === '/connections.css') return sendCss(response, connectionStyles);

  if (request.method === 'POST' && parsed.pathname === '/api/v1/auth/web/refresh') {
    response.setHeader('Set-Cookie', 'nexa_web_refresh=e2e-refresh; HttpOnly; SameSite=Lax; Path=/api/v1/auth/web');
    sendJson(response, 200, {
      accessToken: 'connections-e2e-token',
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    });
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/api/v1/auth/me') {
    sendJson(response, 200, {
      id: USER_ID,
      displayName: 'Connections Tester',
      email: 'connections@example.test',
      verification: 'phone',
    });
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/api/v1/feed') {
    sendJson(response, 200, { items: [] });
    return;
  }
  if (request.method === 'POST' && parsed.pathname === '/api/v1/discovery/nearby') {
    sendJson(response, 200, { points: [], resolution: 10, generatedAt: new Date().toISOString(), viewportHash: 'connections-e2e' });
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/api/v1/interactions/inbox') {
    const items = [];
    if (!state.acceptedFriend) {
      items.push({
        id: 'friend-request-item',
        type: 'friend_request',
        createdAt: new Date().toISOString(),
        fromUser: { id: PEER_ID, displayName: 'Peer Friend', avatarUrl: null, verification: 'phone' },
        requestId: REQUEST_ID,
      });
    }
    if (!state.wavedBack) {
      items.push({
        id: 'wave-item',
        type: 'wave',
        createdAt: new Date().toISOString(),
        fromUser: { id: WAVE_USER_ID, displayName: 'Wave Peer', avatarUrl: null, verification: 'selfie' },
        isMutual: false,
      });
    }
    sendJson(response, 200, { items });
    return;
  }
  if (request.method === 'GET' && parsed.pathname === '/api/v1/conversations') {
    sendJson(response, 200, [conversationSummary()]);
    return;
  }
  if (request.method === 'POST' && parsed.pathname === `/api/v1/friends/requests/${REQUEST_ID}/accept`) {
    state.acceptedFriend = true;
    sendJson(response, 200, { accepted: true });
    return;
  }
  if (request.method === 'POST' && parsed.pathname === '/api/v1/interactions/wave') {
    state.waveBody = JSON.parse(await readBody(request));
    state.wavedBack = true;
    sendJson(response, 200, { sent: true });
    return;
  }
  if (request.method === 'GET' && parsed.pathname === `/api/v1/conversations/${CONVERSATION_ID}/messages`) {
    sendJson(response, 200, {
      messages: [{
        id: INITIAL_MESSAGE_ID,
        conversationId: CONVERSATION_ID,
        senderId: PEER_ID,
        body: 'Initial peer message',
        type: 'text',
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      }],
      nextCursor: null,
    });
    return;
  }
  if (request.method === 'POST' && parsed.pathname === `/api/v1/conversations/${CONVERSATION_ID}/read`) {
    state.readMarked = true;
    response.writeHead(204, { 'Cache-Control': 'no-store' });
    response.end();
    return;
  }

  response.writeHead(404).end('Not Found');
}

function conversationSummary() {
  return {
    id: CONVERSATION_ID,
    participantIds: [USER_ID, PEER_ID],
    participants: [
      { id: USER_ID, displayName: 'Connections Tester', avatarUrl: null },
      { id: PEER_ID, displayName: 'Peer Friend', avatarUrl: null },
    ],
    lastMessageAt: new Date(Date.now() - 60_000).toISOString(),
    lastMessage: { senderId: PEER_ID, body: 'Initial peer message' },
    status: 'accepted',
    initiatedBy: PEER_ID,
    isFriend: true,
    peerOnline: true,
    unreadCount: 1,
  };
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) body += String(chunk);
  return body;
}

function sendCss(response, css) {
  response.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(css);
}

function sendJson(response, status, payload) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(payload));
}
