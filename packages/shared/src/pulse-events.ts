import type { ActivityItem } from './activity';

/**
 * Server-authoritative Pulse activity pushed after persistence and privacy filtering.
 * `item.id` is the stable client dedupe key across REST + Socket.IO.
 */
export interface PulseActivityEvent {
  item: ActivityItem;
  emittedAt: string;
}

/** Remove a previously delivered activity after server-side visibility/consent revocation. */
export interface PulseActivityRemoveEvent {
  activityId: string;
  emittedAt: string;
}

declare module './events' {
  interface ServerToClientEvents {
    'pulse:activity': (e: PulseActivityEvent) => void;
    'pulse:activity:remove': (e: PulseActivityRemoveEvent) => void;
  }
}
