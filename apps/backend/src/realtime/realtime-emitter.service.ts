import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@g88/shared';
import type { Server } from 'socket.io';

import { RealtimeGateway } from './realtime.gateway';

export type G88RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/**
 * Small Socket.IO emission boundary shared by realtime producers.
 * Resolves the gateway lazily so producers do not participate in the gateway's
 * constructor dependency graph.
 */
@Injectable()
export class RealtimeEmitterService {
  constructor(private readonly moduleRef: ModuleRef) {}

  to(roomOrSocketId: string): ReturnType<G88RealtimeServer['to']> {
    return this.server.to(roomOrSocketId);
  }

  /**
   * Remove every socket for the supplied users from one room.
   * `socketsLeave()` is adapter-aware, so this applies across Socket.IO nodes
   * when the configured adapter supports cluster-wide room operations.
   */
  leaveRoomForUsers(userIds: readonly string[], room: string): void {
    for (const userId of new Set(userIds)) {
      this.server.in(`user:${userId}`).socketsLeave(room);
    }
  }

  private get server(): G88RealtimeServer {
    const gateway = this.moduleRef.get(RealtimeGateway, { strict: false });
    return gateway.server;
  }
}
