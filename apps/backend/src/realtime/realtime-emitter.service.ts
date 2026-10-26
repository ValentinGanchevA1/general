import { Injectable } from '@nestjs/common';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@g88/shared';
import type { Server } from 'socket.io';

export type G88RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

/**
 * Small Socket.IO emission boundary shared by realtime producers.
 * The gateway owns connection lifecycle; producers depend only on this service.
 */
@Injectable()
export class RealtimeEmitterService {
  private server: G88RealtimeServer | null = null;

  attach(server: G88RealtimeServer): void {
    this.server = server;
  }

  to(roomOrSocketId: string): ReturnType<G88RealtimeServer['to']> {
    if (this.server === null) {
      throw new Error('RealtimeEmitterService is not attached to a Socket.IO server');
    }
    return this.server.to(roomOrSocketId);
  }
}
