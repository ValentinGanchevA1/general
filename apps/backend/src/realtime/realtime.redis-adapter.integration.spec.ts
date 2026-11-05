import { createServer, type Server as HttpServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import type { AddressInfo } from 'node:net';
import type { ModuleRef } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { createAdapter } from '@socket.io/redis-adapter';
import type Redis from 'ioredis';
import { DataSource, type EntityManager } from 'typeorm';
import { Server as SocketIoServer, type Socket as ServerSocket } from 'socket.io';
import type {
  ClientToServerEvents,
  FriendPresenceEvent,
  LocationShareUpdateEvent,
  ServerToClientEvents,
  SocketData,
} from '@g88/shared';

import { GroupConversationsController } from '../modules/chat/group-conversations.controller';
import { JwtStrategy } from '../modules/auth/jwt.strategy';
import { ChatRealtimeAccessService } from '../modules/chat/chat-realtime-access.service';
import { GroupConversationsService } from '../modules/chat/group-conversations.service';
import { createRedisClient } from '../config/redis-client';
import { RealtimeEmitterService } from './realtime-emitter.service';
import { RealtimeGateway } from './realtime.gateway';

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
  jest.setTimeout(30_000);
  const itPostgres = process.env.NEXA_ROOM_TEST_DATABASE_URL ? it : it.skip;

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

      // Exercise the actual group service/controller path with a simulated
      // committed transaction. Redis sockets/adapters above are real; PostgreSQL
      // and the HTTP/JWT layer are deliberately not part of this regression.
      let committed = false;
      let memberSoftLeft = false;
      const txQuery = jest.fn(async (sql: string): Promise<unknown[]> => {
        if (sql.includes('FROM conversations')) return [{ id: conversationId }];
        if (sql.includes('FROM conversation_members')) {
          return [
            { user_id: activeId, role: 'owner', joined_at: '2026-11-01T08:00:00Z' },
            { user_id: userId, role: 'member', joined_at: '2026-11-01T09:00:00Z' },
          ];
        }
        if (sql.includes('UPDATE conversation_members') && sql.includes('SET left_at = NOW()')) {
          memberSoftLeft = true;
          return [];
        }
        throw new Error('Unexpected query in group-removal integration regression');
      });
      const transaction = jest.fn(async (work: (tx: EntityManager) => Promise<void>): Promise<void> => {
        await work({ query: txQuery } as unknown as EntityManager);
        committed = true;
      });
      const groups = new GroupConversationsService({ transaction } as unknown as DataSource);
      const groupController = new GroupConversationsController(
        groups,
        { get: (token: unknown): RealtimeEmitterService => {
          expect(token).toBe(RealtimeEmitterService);
          return emitter;
        } } as unknown as ModuleRef,
      );
      const originalLeave = emitter.leaveRoomForUsers.bind(emitter);
      const leaveSpy = jest.spyOn(emitter, 'leaveRoomForUsers')
        .mockImplementation((memberIds, room) => {
          expect(committed).toBe(true);
          originalLeave(memberIds, room);
        });

      await groupController.removeMember(conversationId, userId, activeId);
      expect(memberSoftLeft).toBe(true);
      expect(transaction).toHaveBeenCalledTimes(1);
      expect(txQuery).toHaveBeenCalledTimes(3);
      expect(leaveSpy).toHaveBeenCalledWith([userId], conversationRoom);
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


  itPostgres('revokes remote group sockets after JWT HTTP kick and a real PostgreSQL commit', async () => {
    const databaseUrl = process.env.NEXA_ROOM_TEST_DATABASE_URL;
    if (!databaseUrl) throw new Error('Isolated PostgreSQL test URL is required');
    const databaseTarget = new URL(databaseUrl);
    if (databaseTarget.hostname !== '127.0.0.1' || databaseTarget.pathname !== '/nexa_room_test') {
      throw new Error('Refusing to use a non-isolated group-room test database');
    }
    const actorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const key = `nexa:test:socket.io:http-db:${process.pid}`;
    const nodeA = await createRedisBackedNode(key, 'db-http-a');
    const nodeB = await createRedisBackedNode(key, 'db-http-b');
    const realtimeA = nodeA.io.of('/realtime');
    const realtimeB = nodeB.io.of('/realtime');
    const clients: TestSocketClient[] = [];
    const revokedSockets: RealtimeServerSocket[] = [];
    const activeSockets: RealtimeServerSocket[] = [];
    const db = new DataSource({ type: 'postgres', url: databaseUrl, synchronize: false, entities: [] });
    let app: INestApplication | null = null;
    const oldSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = randomBytes(32).toString('hex');

    try {
      await db.initialize();
      // These tables exist only in the isolated CI database, not production.
      await db.query('CREATE TABLE users (id uuid PRIMARY KEY, deleted_at timestamptz)');
      await db.query("CREATE TABLE conversations (id uuid PRIMARY KEY, kind text NOT NULL, participant_ids uuid[] NOT NULL DEFAULT ARRAY[]::uuid[])");
      await db.query(
        'CREATE TABLE conversation_members (conversation_id uuid NOT NULL REFERENCES conversations(id), '
        + 'user_id uuid NOT NULL REFERENCES users(id), role text NOT NULL, '
        + 'joined_at timestamptz NOT NULL DEFAULT NOW(), left_at timestamptz, '
        + 'PRIMARY KEY (conversation_id, user_id))',
      );
      await db.query('CREATE TABLE user_blocks (blocker_id uuid NOT NULL, blocked_id uuid NOT NULL)');
      await db.query('INSERT INTO users (id) VALUES ($1), ($2)', [actorId, userId]);
      await db.query("INSERT INTO conversations (id, kind) VALUES ($1, 'group')", [conversationId]);
      await db.query(
        "INSERT INTO conversation_members (conversation_id, user_id, role) VALUES ($1, $2, 'owner'), ($1, $3, 'member')",
        [conversationId, actorId, userId],
      );

      const joinSockets = (socket: RealtimeServerSocket): void => {
        const subject = socket.handshake.auth.userId;
        if (subject !== actorId && subject !== userId) {
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
      realtimeA.on('connection', joinSockets);
      realtimeB.on('connection', joinSockets);

      const moduleRef = await Test.createTestingModule({
        imports: [PassportModule, JwtModule.register({ secret: process.env.JWT_SECRET })],
        controllers: [GroupConversationsController],
        providers: [
          GroupConversationsService, ChatRealtimeAccessService,
          RealtimeEmitterService, JwtStrategy,
          { provide: getDataSourceToken(), useValue: db },
          { provide: RealtimeGateway, useValue: { server: realtimeA } },
        ],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.listen(0, '127.0.0.1');
      const address = app.getHttpServer().address() as AddressInfo;
      const path = `http://127.0.0.1:${address.port}/conversations/groups/${conversationId}/members`;
      const jwt = app.get(JwtService);
      const ownerToken = jwt.sign({ sub: actorId, email: 'owner@example.invalid' });
      const memberToken = jwt.sign({ sub: userId, email: 'member@example.invalid' });

      const removedA = await connectUser(`http://127.0.0.1:${nodeA.port}/realtime`);
      const removedB1 = await connectUser(`http://127.0.0.1:${nodeB.port}/realtime`);
      const removedB2 = await connectUser(`http://127.0.0.1:${nodeB.port}/realtime`);
      const activeB = await connectUser(`http://127.0.0.1:${nodeB.port}/realtime`, actorId);
      clients.push(removedA, removedB1, removedB2, activeB);
      await waitFor(() =>
        revokedSockets.length === 3 && activeSockets.length === 1
        && revokedSockets.every((socket) => socket.rooms.has(conversationRoom))
        && activeSockets.every((socket) => socket.rooms.has(conversationRoom)),
      );

      const recipients = app.get(ChatRealtimeAccessService);
      const originalRecipients = await recipients.getRecipientIds(conversationId);
      expect([...originalRecipients].sort()).toEqual([actorId, userId].sort());

      const unauthenticated = await fetch(`${path}/${userId}`, { method: 'DELETE' });
      expect(unauthenticated.status).toBe(401);
      const forbidden = await fetch(`${path}/${actorId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${memberToken}` },
      });
      expect(forbidden.status).toBe(403);
      expect(revokedSockets.every((socket) => socket.rooms.has(conversationRoom))).toBe(true);

      const revokedEvents: LocationShareUpdateEvent[][] = [[], [], []];
      removedA.on('location:share:update', (event) => revokedEvents[0]!.push(event));
      removedB1.on('location:share:update', (event) => revokedEvents[1]!.push(event));
      removedB2.on('location:share:update', (event) => revokedEvents[2]!.push(event));
      const activeEvents: LocationShareUpdateEvent[] = [];
      activeB.on('location:share:update', (event) => activeEvents.push(event));

      const kick = await fetch(`${path}/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
      expect(kick.status).toBe(204);
      const membership = await db.query<Array<{ left_at: Date | null }>>(
        'SELECT left_at FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
        [conversationId, userId],
      );
      expect(membership[0]?.left_at).toBeInstanceOf(Date);
      await expect(recipients.getRecipientIds(conversationId)).resolves.toEqual([actorId]);
      await waitFor(() =>
        revokedSockets.every((socket) => !socket.rooms.has(conversationRoom))
        && activeSockets.every((socket) => socket.rooms.has(conversationRoom)),
      );
      expect(revokedSockets.every((socket) => socket.rooms.has(userRoom))).toBe(true);

      const event: LocationShareUpdateEvent = {
        sessionId, conversationId,
        location: { lat: 43.214, lng: 27.935 },
        updatedAt: '2026-10-28T20:00:00.000Z',
      };
      realtimeA.to(conversationRoom).emit('location:share:update', event);
      await waitFor(() => activeEvents.length === 1);
      await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, 150));
      expect(activeEvents).toEqual([event]);
      expect(revokedEvents).toEqual([[], [], []]);
    } finally {
      for (const client of clients) client.close();
      if (app) await app.close();
      if (db.isInitialized) await db.destroy();
      if (oldSecret === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = oldSecret;
      await Promise.all([closeNode(nodeA), closeNode(nodeB)]);
    }
  });

});
