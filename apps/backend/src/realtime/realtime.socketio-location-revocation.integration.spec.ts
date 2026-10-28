import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { Server as SocketIoServer, type Socket as ServerSocket } from 'socket.io';
import type {
  AckResult,
  ClientToServerEvents,
  LocationShareUpdateEvent,
  ServerToClientEvents,
  SocketData,
} from '@g88/shared';

import { RealtimeGateway } from './realtime.gateway';

const conversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sharerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const peerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const sessionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const location = { lat: 43.21357, lng: 27.93461 };
const updatedAt = '2026-10-28T18:00:00.000Z';

type RealtimeServerSocket = ServerSocket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

interface TestSocketClient {
  readonly connected: boolean;
  once(event: 'connect', listener: () => void): this;
  once(event: 'connect_error', listener: (error: Error) => void): this;
  on(event: 'location:share:update', listener: (event: LocationShareUpdateEvent) => void): this;
  emit(
    event: 'conversation:join',
    payload: { conversationId: string },
    ack: (result: AckResult<{ joined: true }>) => void,
  ): this;
  emit(
    event: 'location:share:update',
    payload: { sessionId: string; location: { lat: number; lng: number } },
    ack: (result: AckResult<{ updatedAt: string }>) => void,
  ): this;
  close(): this;
}

interface SocketIoClientModule {
  io(
    uri: string,
    options: {
      transports: string[];
      auth: { token: string };
      forceNew: boolean;
      reconnection: boolean;
    },
  ): TestSocketClient;
}

const requireFromWeb = createRequire(resolve(__dirname, '../../../../web/package.json'));
const socketIoClient = requireFromWeb('socket.io-client') as SocketIoClientModule;

function listen(server: HttpServer): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      resolvePromise();
    });
  });
}

function connectUser(uri: string, userId: string): Promise<TestSocketClient> {
  const client = socketIoClient.io(uri, {
    transports: ['websocket'],
    auth: { token: userId },
    forceNew: true,
    reconnection: false,
  });

  return new Promise((resolvePromise, reject) => {
    client.once('connect', () => resolvePromise(client));
    client.once('connect_error', reject);
  });
}

function joinConversation(client: TestSocketClient): Promise<AckResult<{ joined: true }>> {
  return new Promise((resolvePromise) => {
    client.emit('conversation:join', { conversationId }, resolvePromise);
  });
}

function updateLocation(client: TestSocketClient): Promise<AckResult<{ updatedAt: string }>> {
  return new Promise((resolvePromise) => {
    client.emit('location:share:update', { sessionId, location }, resolvePromise);
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for Socket.IO delivery');
    }
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 10));
  }
}

async function closeServer(io: SocketIoServer, httpServer: HttpServer): Promise<void> {
  await new Promise<void>((resolvePromise) => io.close(() => resolvePromise()));
  if (!httpServer.listening) return;
  await new Promise<void>((resolvePromise, reject) => {
    httpServer.close((error) => {
      if (error) reject(error);
      else resolvePromise();
    });
  });
}

describe('RealtimeGateway Socket.IO location revocation integration', () => {
  jest.setTimeout(15_000);

  it('does not deliver precise GPS to a blocked peer that remains in a stale conversation room', async () => {
    const httpServer = createServer();
    const io = new SocketIoServer<
      ClientToServerEvents,
      ServerToClientEvents,
      Record<string, never>,
      SocketData
    >(httpServer, { transports: ['websocket'] });
    const realtime = io.of('/realtime');
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const serverSockets = new Map<string, RealtimeServerSocket>();
    const clients: TestSocketClient[] = [];
    let authorizedRecipientIds = [sharerId, peerId];

    const query = jest.fn().mockImplementation(async () => (
      authorizedRecipientIds.map((userId) => ({ user_id: userId }))
    ));
    const update = jest.fn().mockResolvedValue({ conversationId, updatedAt });
    const verify = jest.fn((token: string) => ({ sub: token }));

    Object.assign(gateway, {
      db: { query },
      jwt: { verify },
      locationShare: { update },
      server: realtime,
      logger: { log: jest.fn(), error: jest.fn() },
    });

    realtime.on('connection', (socket) => {
      void gateway.handleConnection(socket as never);
      serverSockets.set(socket.data.userId, socket);

      socket.on('conversation:join', (payload, ack) => {
        void gateway.onConversationJoin(socket as never, payload).then(ack);
      });
      socket.on('location:share:update', (payload, ack) => {
        void gateway.onLocationShareUpdate(socket as never, payload).then(ack);
      });
    });

    try {
      await listen(httpServer);
      const address = httpServer.address();
      if (address == null || typeof address === 'string') {
        throw new Error('Socket.IO integration server did not bind a TCP port');
      }
      const uri = `http://127.0.0.1:${address.port}/realtime`;

      const sharer = await connectUser(uri, sharerId);
      clients.push(sharer);
      const peer = await connectUser(uri, peerId);
      clients.push(peer);

      await expect(joinConversation(sharer)).resolves.toEqual({ ok: true, data: { joined: true } });
      await expect(joinConversation(peer)).resolves.toEqual({ ok: true, data: { joined: true } });

      const peerServerSocket = serverSockets.get(peerId);
      expect(peerServerSocket).toBeDefined();
      const staleRoom = `convo:${conversationId}`;
      expect(peerServerSocket?.rooms.has(staleRoom)).toBe(true);

      const sharerUpdates: LocationShareUpdateEvent[] = [];
      const peerUpdates: LocationShareUpdateEvent[] = [];
      sharer.on('location:share:update', (event) => sharerUpdates.push(event));
      peer.on('location:share:update', (event) => peerUpdates.push(event));

      // Simulate the authoritative post-block recipient query while deliberately
      // leaving the peer subscribed to the old conversation room.
      authorizedRecipientIds = [sharerId];

      await expect(updateLocation(sharer)).resolves.toEqual({
        ok: true,
        data: { updatedAt },
      });
      await waitFor(() => sharerUpdates.length === 1);
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 100));

      expect(sharerUpdates).toEqual([
        {
          sessionId,
          conversationId,
          location,
          updatedAt,
        },
      ]);
      expect(peerUpdates).toEqual([]);
      expect(peerServerSocket?.rooms.has(staleRoom)).toBe(true);
      expect(update).toHaveBeenCalledWith(sharerId, sessionId, location);
      expect(query).toHaveBeenLastCalledWith(expect.stringContaining('user_blocks'), [conversationId]);
    } finally {
      for (const client of clients) client.close();
      await closeServer(io, httpServer);
    }
  });
});
