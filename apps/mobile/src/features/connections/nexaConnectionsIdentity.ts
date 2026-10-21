import type { InboxItem } from '@g88/shared';

export type NexaConnectionsView = 'activity' | 'chats';

export interface NexaConnectionsViewIdentity {
  label: string;
  icon: string;
  accessibilityLabel: string;
}

export const NEXA_CONNECTIONS_VIEWS: Record<
  NexaConnectionsView,
  NexaConnectionsViewIdentity
> = {
  activity: {
    label: 'Activity',
    icon: 'account-multiple-outline',
    accessibilityLabel: 'Connection activity',
  },
  chats: {
    label: 'Chats',
    icon: 'message-text-outline',
    accessibilityLabel: 'Chats',
  },
};

/**
 * Activity that still offers a direct relationship action.
 * Passive reactions, gifts, matches and durable notifications are intentionally
 * excluded so attention UI never turns into a popularity metric.
 */
export function isActionableConnectionActivity(item: InboxItem): boolean {
  if (item.type === 'friend_request') return item.requestId != null && item.requestId !== '';
  if (item.type === 'follow') return item.isFollowingBack !== true;
  if (item.type === 'wave') return item.isMutual !== true;
  return false;
}

export function formatConnectionsBadge(count: number): string | null {
  if (!Number.isFinite(count) || count <= 0) return null;
  if (count > 99) return '99+';
  return String(Math.floor(count));
}

export interface ConnectionsEmptyCopy {
  icon: string;
  title: string;
  body: string;
  actionLabel: string;
}

export function connectionsEmptyCopy(view: NexaConnectionsView): ConnectionsEmptyCopy {
  if (view === 'chats') {
    return {
      icon: 'message-text-outline',
      title: 'No conversations yet',
      body: 'Discover someone nearby, then start with a Wave or Message when the connection allows it.',
      actionLabel: 'Discover people',
    };
  }

  return {
    icon: 'account-multiple-outline',
    title: 'No connection activity yet',
    body: 'Waves, connection requests and follows will appear here when people reach out.',
    actionLabel: 'Discover nearby',
  };
}
