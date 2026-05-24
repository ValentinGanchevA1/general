// apps/mobile/src/components/actionHubActions.ts
import type { PulseFilter } from '@/navigation/AppNavigator';

export interface ActionHubAction {
  key: string;
  icon: string;
  label: string;
  filter: PulseFilter;
}

export const ACTION_HUB_ACTIONS: readonly ActionHubAction[] = [
  { key: 'chats',    icon: 'message-text', label: 'Chats',   filter: 'chats' },
  { key: 'waves',    icon: 'hand-wave',    label: 'Waves',   filter: 'waves' },
  { key: 'alerts',   icon: 'bullhorn',     label: 'Alerts',  filter: 'alerts' },
  { key: 'listings', icon: 'tag',          label: 'Trades',  filter: 'listings' },
  { key: 'matches',  icon: 'heart',        label: 'Matches', filter: 'matches' },
] as const;

export function findAction(key: string): ActionHubAction | undefined {
  return ACTION_HUB_ACTIONS.find((a) => a.key === key);
}
