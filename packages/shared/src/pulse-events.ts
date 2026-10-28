import type { ActivityItem } from './activity';

/**
 * Server-authoritative Pulse activity pushed after persistence and privacy filtering.
 * `item.id` is the stable client dedupe key across REST + Socket.IO.
 */
export interface PulseActivityEvent {
  item: ActivityItem;
  emittedAt: string;
}

declare module './events' {
  interface ServerToClientEvents {
    'pulse:activity': (e: PulseActivityEvent) => void;
  }
}
