export type NexaMainTab = 'Map' | 'Discover' | 'Pulse' | 'Connections' | 'You';
export type NexaTabTone = 'discovery' | 'action';

export interface NexaTabVisual {
  label: NexaMainTab;
  icon: string;
  activeIcon: string;
  tone: NexaTabTone;
  accessibilityLabel: string;
}

export const NEXA_MAIN_TAB_ORDER = [
  'Map',
  'Discover',
  'Pulse',
  'Connections',
  'You',
] as const satisfies readonly NexaMainTab[];

export const NEXA_TAB_VISUALS: Record<NexaMainTab, NexaTabVisual> = {
  Map: {
    label: 'Map',
    icon: 'map-outline',
    activeIcon: 'map',
    tone: 'discovery',
    accessibilityLabel: 'Map, nearby discovery',
  },
  Discover: {
    label: 'Discover',
    icon: 'compass-outline',
    activeIcon: 'compass',
    tone: 'discovery',
    accessibilityLabel: 'Discover people, events and marketplace',
  },
  Pulse: {
    label: 'Pulse',
    icon: 'pulse',
    activeIcon: 'pulse',
    tone: 'discovery',
    accessibilityLabel: 'Pulse, live local activity',
  },
  Connections: {
    label: 'Connections',
    icon: 'account-multiple-outline',
    activeIcon: 'account-multiple',
    tone: 'action',
    accessibilityLabel: 'Connections, chats and activity',
  },
  You: {
    label: 'You',
    icon: 'account-circle-outline',
    activeIcon: 'account-circle',
    tone: 'action',
    accessibilityLabel: 'You, your profile',
  },
};

/** Actionable/unread connection state only. This is never a vanity metric. */
export function resolveConnectionsTabBadge(
  unreadChats: number,
  pendingConnections: number,
): number | '99+' | undefined {
  const total = Math.max(0, unreadChats) + Math.max(0, pendingConnections);
  if (total <= 0) return undefined;
  if (total > 99) return '99+';
  return total;
}
