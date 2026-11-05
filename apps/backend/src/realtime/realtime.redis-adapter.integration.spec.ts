import { createServer, type Server as HttpServer } from 'node:http';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { ModuleRef } from '@nestjs/core';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import { Server as SocketIoServer, type Socket as ServerSocket } from 'socket.io';
import type {
  ClientToServerEvents,
  FriendPresenceEvent,
  LocationShareUpdateEvent,
  ServerToClientEvents,
  SocketData,
} from '@g88/shared';

import { createRedisClient } from '../config/redis-client';
import { RealtimeEmitterService } from './realtime-emitter.service';
import type { RealtimeGateway } from './realtime.gateway';

const describeRedis = process.env.REDIS_ADAPTER_TEST === 'true' ? describe : describe.skip;

const userId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const conversationId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sessionId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const userRoom = `user:${userId}`;
const conversationRoom = `convo:${conversationId}`;

interface TestSocketClient {
  once(event: 'connect', listener: () => void): this;
  once(event: 'connect_error', listener: (error: Error) => void): this;
  on(event: 'friend:presence', listener: (event: FriendPresenceEvent) => void): this;
  on(event: 'location:share:update', listener: (event: LocationShareUpdateEvent) => void): this;
  close(): this;
}

interface SocketIoClientModule {
  io(
    uri: string,
    options: {
      transports: string[];
      auth: { userId: string; conversationId: string };
      forceNew: boolean;
      reconnection: boolean;
    },
  ): TestSocketClient;
}

type RealtimeServerSocket = ServerSocket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

interface RedisBackedNode {
  readonly httpServer: HttpServer;
  readonly io: SocketIoServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >;
  readonly publisher: Redis;
  readonly subscriber: Redis;
  readonly port: number;
}

const requireFromWeb = createRequire(resolve(__dirname, '../../../../web/package.json'));
const socketIoClient = requireFromWeb('socket.io-client') as SocketIoClientModule;

function listen(server: HttpServer): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const onError = (error: Error): void => reject(error);
    server.once('error', onError);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', onError);
      const address = server.address();
      if (address == null || typeof address === 'string') {
        reject(new Error('Socket.IO Redis integration server did not bind a TCP port'));
        return;
      }
      resolvePromise((address as AddressInfo).port);
    });
  });
}

async function createRedisBackedNode(channelKey: string, connectionSuffix: string): Promise<RedisBackedNode> {
  const publisher = createRedisClient(
    {
      lazyConnect: true,
      maxRetriesPerRequest: null,
      connectionName: `nexa-test-${connectionSuffix}-publisher`,
    },
    { REDIS_HOST: '127.0.0.1', REDIS_PORT: '6379' },
  );
  const subscriber = publisher.duplicate({
    lazyConnect: true,
    maxRetriesPerRequest: null,
    connectionName: `nexa-test-${connectionSuffix}-subscriber`,
  });

  await Promise.all([publisher.connect(), subscriber.connect()]);

  const httpServer = createServer();
  const io = new SocketIoServer<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, { transports: ['websocket'] });
  io.adapter(
    createAdapter(publisher, subscriber, {
      key: channelKey,
      publishOnSpecificResponseChannel: true,
    }),
  );

  const port = await listen(httpServer);
  return { httpServer, io, publisher, subscriber, port };
}

function connectUser(
  uri: string,
  subjectId = userId,
): Promise<TestSocketClient> {
  const client = socketIoClient.io(uri, {
    transports: ['websocket'],
    auth: { userId: subjectId, conversationId },
    forceNew: true,
    reconnection: false,
  });

  return new Promise((resolvePromise, reject) => {
    client.once('connect', () => resolvePromise(client));
    client.once('connect_error', reject);
  });
}

async function waitFor(predicate: () => boolean, timeoutMs = 3_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for cross-instance Socket.IO state');
    }
    await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 20));
  }
}

async function closeRedis(client: Redis): Promise<void> {
  if (client.status === 'end') return;
  if (client.status === 'wait') {
    client.disconnect();
    return;
  }
  try {
    await client.quit();
  } catch {
    client.disconnect();
  }
}

async function closeNode(node: RedisBackedNode): Promise<void> {
  await new Promise<void>((resolvePromise) => node.io.close(() => resolvePromise()));
  if (node.httpServer.listening) {
    await new Promise<void>((resolvePromise, reject) => {
      node.httpServer.close((error) => {
        if (error) reject(error);
        else resolvePromise();
      });
    });
  }
  await Promise.all([closeRedis(node.publisher), closeRedis(node.subscriber)]);
}

describeRedis('Socket.IO Redis adapter multi-instance topology', () => {
  jest.setTimeout(20_000);

  it('fans out user events and remotely evicts a revoked conversation room', async () => {
    const channelKey = `nexa:test:socket.io:${process.pid}`;
    const nodeA = await createRedisBackedNode(channelKey, 'a');
    const nodeB = await createRedisBackedNode(channelKey, 'b');
    const realtimeA = nodeA.io.of('/realtime');
    const realtimeB = nodeB.io.of('/realtime');
    let remoteSocket: RealtimeServerSocket | null = null;
    const clients: TestSocketClient[] = [];

    realtimeB.on('connection', (socket) => {
      const authUserId = socket.handshake.auth.userId;
      const authConversationId = socket.handshake.auth.conversationId;
      if (typeof authUserId !== 'string' || typeof authConversationId !== 'string') {
        socket.disconnect(true);
        return;
      }
      socket.data.userId = authUserId;
      socket.data.rooms = new Set<string>();
      void socket.join(`user:${authUserId}`);
      void socket.join(`convo:${authConversationId}`);
      remoteSocket = socket;
    });

    const gateway = { server: realtimeA } as unknown as RealtimeGateway;
    const moduleRef = {
      get: (): RealtimeGateway => gateway,
    } as unknown as ModuleRef;
    const emitter = new RealtimeEmitterService(moduleRef);

    try {
      const client = await connectUser(`http://127.0.0.1:${nodeB.port}/realtime`);
      clients.push(client);
      await waitFor(() => remoteSocket !== null && remoteSocket.rooms.has(conversationRoom));

      const presenceEvents: FriendPresenceEvent[] = [];
      client.on('friend:presence', (event) => presenceEvents.push(event));
      emitter.to(userRoom).emit('friend:presence', { userId, online: true });
      await waitFor(() => presenceEvents.length === 1);
      expect(presenceEvents).toEqual([{ userId, online: true }]);

      emitter.leaveRoomForUsers([userId], conversationRoom);
      await waitFor(() => remoteSocket !== null && !remoteSocket.rooms.has(conversationRoom));

      const leakedLocations: LocationShareUpdateEvent[] = [];
      client.on('location:share:update', (event) => leakedLocations.push(event));
      emitter.to(conversationRoom).emit('location:share:update', {
        sessionId,
        conversationId,
        location: { lat: 43.214, lng: 27.935 },
        updatedAt: '2026-10-28T20:00:00.000Z',
      });
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 150));

      expect(leakedLocations).toEqual([]);
      expect((remoteSocket as RealtimeServerSocket | null)?.rooms.has(userRoom)).toBe(true);

      emitter.to(userRoom).emit('friend:presence', { userId, online: false });
      await waitFor(() => presenceEvents.length === 2);
      expect(presenceEvents.at(-1)).toEqual({ userId, online: false });
    } finally {
      for (const client of clients) client.close();
      await Promise.all([closeNode(nodeA), closeNode(nodeB)]);
    }
  });

  it('evicts all revoked devices across two Redis adapter nodes, preserving active group members', async () => {
    // Distinct authorized and revoked subjects, with two removed devices on node B
    // and one on node A. This tests adapter room semantics, not Nest HTTP auth.
    const activeId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const channelKey = `nexa:test:socket.io:multi-device:${process.pid}`;
    const nodeA = await createRedisBackedNode(channelKey, 'multi-a');
    const nodeB = await createRedisBackedNode(channelKey, 'multi-b');
    const realTimeA = nodeA.io.of('/realtime');
    const realTimeB = nodeB.io.of('/realtime');
    const revokedSockets: RealtimeServerSocket[] = [];
    const activeSockets: RealtimeServerSocket[] = [];
    const clients: TestSocketClient[] = [];

    const connectHandler = (socket: RealtimeServerSocket): void => {
      const subject = socket.handshake.auth.userId;
      if (subject !== userId && subject !== activeId) {
        socket.disconnect(true);
        return;
      }
      socket.data.userId = subject;
      socket.data.rooms = new Set<string>();
      void socket.join(`user:${subject}`);
      void socket.join(conversationRoom);
      if (subject === userId) revokedSockets.push(socket);
      else activeSockets.push(socket);
    };
    realTimeA.on('connection', connectHandler);
    realTimeB.on('connection', connectHandler);
    const gateway = { server: realTimeA } as unknown as RealtimeGateway;
    const moduleRef = {
      get: (): RealtimeGateway => gateway,
    } as unknown as ModuleRef;
    const emitter = new RealtimeEmitterService(moduleRef);

    try {
      const revokedA = await connectUser(`http://127.0.0.1:${nodeA.port}/realtime`);
      clients.push(revokedA);
      const revokedB1 = await connectUser(`http://127.0.0.1:${nodeB.port}/realtime`);
      clients.push(revokedB1);
      const revokedB2 = await connectUser(`http://127.0.0.1:${nodeB.port}/realtime`);
      clients.push(revokedB2);
      const activeB = await connectUser(`http://127.0.0.1:${nodeB.port}/realtime`, activeId);
      clients.push(activeB);
      await waitFor(() =>
        revokedSockets.length === 3 && activeSockets.length === 1
        && revokedSockets.every((socket) => socket.rooms.has(conversationRoom))
        && activeSockets.every((socket) => socket.rooms.has(conversationRoom)),
      );

      const revokedEvents: LocationShareUpdateEvent[][] = [[], [], []];
      revokedA.on('location:share:update', (event) => revokedEvents[0]!.push(event));
      revokedB1.on('location:share:update', (event) => revokedEvents[1]!.push(event));
      revokedB2.on('location:share:update', (event) => revokedEvents[2]!.push(event));
      const allowedEvents: LocationShareUpdateEvent[] = [];
      activeB.on('location:share:update', (event) => allowedEvents.push(event));

      // Equivalent to the post-commit group membership eviction.
      emitter.leaveRoomForUsers([userId], conversationRoom);
      await waitFor(() =>
        revokedSockets.every((socket) => !socket.rooms.has(conversationRoom))
        && activeSockets.every((socket) => socket.rooms.has(conversationRoom)),
      );
      expect(revokedSockets.every((socket) => socket.rooms.has(userRoom))).toBe(true);
      expect(activeSockets.every((socket) => socket.rooms.has(`user:${activeId}`))).toBe(true);

      const event: LocationShareUpdateEvent = {
        sessionId, conversationId,
        location: { lat: 43.214, lng: 27.935 },
        updatedAt: '2026-10-28T20:00:00.000Z',
      };
      emitter.to(conversationRoom).emit('location:share:update', event);
      await waitFor(() => allowedEvents.length === 1);
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 150));
      expect(allowedEvents).toEqual([event]);
      expect(revokedEvents).toEqual([[], [], []]);
    } finally {
      for (const client of clients) client.close();
      await Promise.all([closeNode(nodeA), closeNode(nodeB)]);
    }
  });

});
