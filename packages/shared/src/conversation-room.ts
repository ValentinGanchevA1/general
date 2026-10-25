import type { AckResult } from './events';

declare module './events' {
  interface ClientToServerEvents {
    /** Leave a previously joined realtime chat room. */
    'conversation:leave': (
      p: { conversationId: string },
      ack: (r: AckResult<{ left: true }>) => void,
    ) => void;
  }
}

export {};
