/** Canonical visible product destinations; old route identifiers remain compatibility-only. */
export type NexaMainTab = 'Map' | 'Experiences' | 'Opportunities' | 'Connections' | 'Identity';
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
  'Experiences',
  'Opportunities',
  'Connections',
  'Identity',
] as const satisfies readonly NexaMainTab[];

export function isNexaMainTab(name: string): name is NexaMainTab {
  return NEXA_MAIN_TAB_ORDER.some((tab) => tab === name);
}

/** Route focus and visual/a11y selection differ for spatial tabs sharing Map. */
export function isNexaTabSelected(
  tab: NexaMainTab,
  lens: 'map' | 'experiences' | 'opportunities' | 'custom',
  mapHostActive: boolean,
  focused: boolean,
): boolean {
  if (tab === 'Map') return mapHostActive && (lens === 'map' || lens === 'custom');
  if (tab === 'Experiences') return mapHostActive && lens === 'experiences';
  if (tab === 'Opportunities') return mapHostActive && lens === 'opportunities';
  return focused;
}

export const NEXA_TAB_VISUALS: Record<NexaMainTab, NexaTabVisual> = {
  Map: {
    label: 'Map',
    icon: 'map-outline',
    activeIcon: 'map',
    tone: 'discovery',
    accessibilityLabel: 'Map, explore people and activity nearby',
  },
  Experiences: {
    label: 'Experiences',
    icon: 'calendar-month-outline',
    activeIcon: 'calendar-month',
    tone: 'discovery',
    accessibilityLabel: 'Experiences, events on the map',
  },
  Opportunities: {
    label: 'Opportunities',
    icon: 'handshake-outline',
    activeIcon: 'handshake',
    tone: 'discovery',
    accessibilityLabel: 'Opportunities, offers and requests on the map',
  },
  Connections: {
    label: 'Connections',
    icon: 'account-multiple-outline',
    activeIcon: 'account-multiple',
    tone: 'action',
    accessibilityLabel: 'Connections, chats and relationship activity',
  },
  Identity: {
    label: 'Identity',
    icon: 'shield-account-outline',
    activeIcon: 'shield-account',
    tone: 'action',
    accessibilityLabel: 'Identity, profile verification and privacy',
  },
};

/** Actionable/unread connection state only; never popularity or trust vanity. */
export function resolveConnectionsTabBadge(
  unreadChats: number,
  pendingConnections: number,
): number | '99+' | undefined {
  const total = Math.max(0, unreadChats) + Math.max(0, pendingConnections);
  if (total <= 0) return undefined;
  if (total > 99) return '99+';
  return total;
}
