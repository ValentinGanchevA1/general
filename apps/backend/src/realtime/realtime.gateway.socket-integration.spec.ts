import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { AddressInfo } from 'node:net';

import type { AckResult, LocationShareUpdateEvent } from '@g88/shared';

import { RealtimeGateway } from './realtime.gateway';
import { RealtimeEmitterService } from './realtime-emitter.service';
import { WsJwtGuard } from './ws-jwt.guard';
import { DiscoveryPresencePublisher } from './discovery-presence.publisher';
import { PresenceService } from '../modules/presence/presence.service';
import { ChatService } from '../modules/chat/chat.service';
import { LocationShareService } from '../modules/chat/location-share.service';
import { NotificationsService } from '../modules/notifications/notifications.service';
import { ChallengesService } from '../modules/challenges/challenges.service';
import { FriendsService } from '../modules/friends/friends.service';
import { BlocksService } from '../modules/blocks/blocks.service';

const NAMESPACE = '/realtime';
const conversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sharerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const peerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const sessionId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const location = { lat: 43.21357, lng: 27.93461 };
const updatedAt = '2026-10-28T20:00:00.000Z';

interface WireMessageEvent {
  data: unknown;
}

interface WireCloseEvent {
  code: number;
  reason: string;
}

interface WireWebSocket {
  onmessage: ((event: WireMessageEvent) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onclose: ((event: WireCloseEvent) => void) | null;
  send(data: string): void;
  close(): void;
}

type WireWebSocketConstructor = new (url: string) => WireWebSocket;

interface AckWaiter {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Minimal Engine.IO v4 + Socket.IO v4 websocket client for integration tests.
 * It deliberately covers only namespace connect, event ACKs and server events,
 * keeping the backend test independent from a sibling workspace client package.
 */
class SocketIoWireClient {
  private socket: WireWebSocket | null = null;
  private nextAckId = 1;
  private readonly ackWaiters = new Map<number, AckWaiter>();
  private readonly eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  private connectResolve: (() => void) | null = null;
  private connectReject: ((error: Error) => void) | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;

  constructor(private readonly url: string) {}

  connect(token: string): Promise<void> {
    const WebSocketCtor = (
      globalThis as unknown as { WebSocket: WireWebSocketConstructor }
    ).WebSocket;
    if (!WebSocketCtor) {
      return Promise.reject(new Error('Node WebSocket is unavailable'));
    }

    return new Promise<void>((resolve, reject) => {
      this.connectResolve = resolve;
      this.connectReject = reject;
      this.connectTimer = setTimeout(() => {
        this.failConnect(new Error('Timed out connecting Socket.IO test client'));
      }, 3_000);

      const socket = new WebSocketCtor(this.url);
      this.socket = socket;
      socket.onmessage = (event) => this.handleTransportMessage(String(event.data), token);
      socket.onerror = () => this.failConnect(new Error('Socket.IO test websocket failed'));
      socket.onclose = (event) => {
        if (!this.intentionalClose) {
          const error = new Error(
            `Socket.IO test websocket closed unexpectedly (${event.code} ${event.reason})`,
          );
          this.failConnect(error);
          this.rejectOutstandingAcks(error);
        }
      };
    });
  }

  emitWithAck<T>(event: string, payload: unknown): Promise<T> {
    const socket = this.requireSocket();
    const ackId = this.nextAckId++;
    const packet = `42${NAMESPACE},${ackId}${JSON.stringify([event, payload])}`;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ackWaiters.delete(ackId);
        reject(new Error(`Timed out waiting for ${event} ACK`));
      }, 3_000);
      this.ackWaiters.set(ackId, {
        resolve: (value) => resolve(value as T),
        reject,
        timer,
      });
      socket.send(packet);
    });
  }

  on<T>(event: string, handler: (payload: T) => void): () => void {
    const wrapped = (payload: unknown): void => handler(payload as T);
    const handlers = this.eventHandlers.get(event) ?? new Set<(payload: unknown) => void>();
    handlers.add(wrapped);
    this.eventHandlers.set(event, handlers);
    return () => handlers.delete(wrapped);
  }

  close(): void {
    this.intentionalClose = true;
    this.clearConnectTimer();
    this.rejectOutstandingAcks(new Error('Socket.IO test client closed'));
    this.socket?.close();
    this.socket = null;
  }

  private handleTransportMessage(raw: string, token: string): void {
    for (const frame of raw.split('\x1e')) {
      if (frame === '2') {
        this.requireSocket().send('3');
        continue;
      }
      if (frame.startsWith('0')) {
        this.requireSocket().send(`40${NAMESPACE},${JSON.stringify({ token })}`);
        continue;
      }
      if (!frame.startsWith('4')) continue;
      this.handleSocketIoPacket(frame.slice(1));
    }
  }

  private handleSocketIoPacket(packet: string): void {
    const connectPrefix = `0${NAMESPACE},`;
    if (packet.startsWith(connectPrefix)) {
      this.clearConnectTimer();
      const resolve = this.connectResolve;
      this.connectResolve = null;
      this.connectReject = null;
      resolve?.();
      return;
    }

    const connectErrorPrefix = `4${NAMESPACE},`;
    if (packet.startsWith(connectErrorPrefix)) {
      this.failConnect(new Error(`Socket.IO namespace connect failed: ${packet}`));
      return;
    }

    const ackPrefix = `3${NAMESPACE},`;
    if (packet.startsWith(ackPrefix)) {
      this.handleAck(packet.slice(ackPrefix.length));
      return;
    }

    const eventPrefix = `2${NAMESPACE},`;
    if (packet.startsWith(eventPrefix)) {
      this.handleEvent(packet.slice(eventPrefix.length));
    }
  }

  private handleAck(body: string): void {
    const match = /^(\d+)(\[.*\])$/s.exec(body);
    if (!match) return;
    const ackId = Number(match[1]);
    const payload = this.parseArray(match[2]);
    const waiter = this.ackWaiters.get(ackId);
    if (!waiter) return;
    clearTimeout(waiter.timer);
    this.ackWaiters.delete(ackId);
    waiter.resolve(payload[0]);
  }

  private handleEvent(body: string): void {
    const payload = this.parseArray(body);
    const event = payload[0];
    if (typeof event !== 'string') return;
    const handlers = this.eventHandlers.get(event);
    if (!handlers) return;
    for (const handler of handlers) handler(payload[1]);
  }

  private parseArray(value: string | undefined): unknown[] {
    if (!value) return [];
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  }

  private requireSocket(): WireWebSocket {
    if (!this.socket) throw new Error('Socket.IO test client is not connected');
    return this.socket;
  }

  private failConnect(error: Error): void {
    this.clearConnectTimer();
    const reject = this.connectReject;
    this.connectResolve = null;
    this.connectReject = null;
    reject?.(error);
  }

  private clearConnectTimer(): void {
    if (!this.connectTimer) return;
    clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  private rejectOutstandingAcks(error: Error): void {
    for (const waiter of this.ackWaiters.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.ackWaiters.clear();
  }
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
}

jest.setTimeout(15_000);

describe('RealtimeGateway real Socket.IO revocation integration', () => {
  let app: INestApplication;
  let gateway: RealtimeGateway;
  let blocks: BlocksService;
  let socketUrl: string;
  let blocked = false;
  let locationUpdate: jest.Mock;
  const clients: SocketIoWireClient[] = [];

  beforeAll(async () => {
    locationUpdate = jest.fn(async () => ({ conversationId, updatedAt }));
    const dbQuery = jest.fn(async (sql: string): Promise<unknown[]> => {
      if (sql.includes('INSERT INTO user_blocks')) {
        blocked = true;
        return [];
      }
      if (sql.includes('CROSS JOIN LATERAL unnest')) {
        return blocked ? [] : [{ user_id: sharerId }, { user_id: peerId }];
      }
      if (sql.includes('COALESCE(status') && sql.includes('FROM conversations')) {
        return [{ id: conversationId }];
      }
      throw new Error(`Unexpected integration-test SQL: ${sql}`);
    });

    const friends = {
      onBlock: jest.fn(async () => undefined),
      friendsSeeOnlineStatus: jest.fn(async () => false),
      listFriendIds: jest.fn(async (): Promise<string[]> => []),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        RealtimeEmitterService,
        WsJwtGuard,
        BlocksService,
        {
          provide: PresenceService,
          useValue: { markOffline: jest.fn(async () => undefined) },
        },
        {
          provide: DiscoveryPresencePublisher,
          useValue: { clear: jest.fn(), publishHeartbeat: jest.fn() },
        },
        { provide: ChatService, useValue: {} },
        { provide: LocationShareService, useValue: { update: locationUpdate } },
        { provide: NotificationsService, useValue: {} },
        { provide: ChallengesService, useValue: { increment: jest.fn(async () => undefined) } },
        { provide: FriendsService, useValue: friends },
        {
          provide: JwtService,
          useValue: { verify: jest.fn((token: string) => ({ sub: token })) },
        },
        { provide: getDataSourceToken(), useValue: { query: dbQuery } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    gateway = app.get(RealtimeGateway);
    blocks = app.get(BlocksService);

    const httpServer = app.getHttpServer() as { address(): AddressInfo | string | null };
    const address = httpServer.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected an ephemeral TCP address for Socket.IO integration test');
    }
    socketUrl = `ws://127.0.0.1:${address.port}/socket.io/?EIO=4&transport=websocket`;
  });

  afterAll(async () => {
    for (const client of clients) client.close();
    await sleep(25);
    await app.close();
  });

  it('pre-joined peer receives no precise GPS after block, even with a stale convo room', async () => {
    blocked = false;
    locationUpdate.mockClear();

    const sharer = new SocketIoWireClient(socketUrl);
    const peer = new SocketIoWireClient(socketUrl);
    clients.push(sharer, peer);
    await Promise.all([sharer.connect(sharerId), peer.connect(peerId)]);

    await expect(
      sharer.emitWithAck<AckResult<{ joined: true }>>('conversation:join', { conversationId }),
    ).resolves.toEqual({ ok: true, data: { joined: true } });
    await expect(
      peer.emitWithAck<AckResult<{ joined: true }>>('conversation:join', { conversationId }),
    ).resolves.toEqual({ ok: true, data: { joined: true } });

    const room = `convo:${conversationId}`;
    await expect(roomUserIds(gateway, room)).resolves.toEqual(
      expect.arrayContaining([sharerId, peerId]),
    );

    await blocks.block(peerId, sharerId);
    await expect(roomUserIds(gateway, room)).resolves.toEqual([]);

    // Simulate a stale cross-instance room membership after the block eviction.
    // Fanout must still depend on current DB authorization, never on convo:*.
    gateway.server.in(`user:${peerId}`).socketsJoin(room);
    await expect(roomUserIds(gateway, room)).resolves.toEqual([peerId]);

    const peerUpdates: LocationShareUpdateEvent[] = [];
    const unsubscribe = peer.on<LocationShareUpdateEvent>('location:share:update', (event) => {
      peerUpdates.push(event);
    });

    await expect(
      sharer.emitWithAck<AckResult<{ updatedAt: string }>>('location:share:update', {
        sessionId,
        location,
      }),
    ).resolves.toEqual({ ok: true, data: { updatedAt } });

    await sleep(100);
    unsubscribe();

    expect(locationUpdate).toHaveBeenCalledWith(sharerId, sessionId, location);
    expect(peerUpdates).toEqual([]);
    await expect(roomUserIds(gateway, room)).resolves.toEqual([peerId]);
  });
});

async function roomUserIds(gateway: RealtimeGateway, room: string): Promise<string[]> {
  const sockets = await gateway.server.in(room).fetchSockets();
  return sockets.map((socket) => socket.data.userId).sort();
}
