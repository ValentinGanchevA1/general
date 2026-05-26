// apps/mobile/src/components/ContextualFab/fabActions.ts
import type { FabActionId } from './useFabContext';

export interface FabActionDef {
  id: FabActionId;
  icon: string;           // MaterialCommunityIcons name (secondary button)
  label: string;          // Shown next to secondary button when expanded
  primaryGlyph: string;   // MCI icon name used when this action is primary
}

export const FAB_ACTIONS: Record<FabActionId, FabActionDef> = {
  wave_nearest: {
    id: 'wave_nearest',
    icon: 'hand-wave',
    label: 'Wave nearby',
    primaryGlyph: 'hand-wave',
  },
  post_alert: {
    id: 'post_alert',
    icon: 'bullhorn',
    label: 'Post alert',
    primaryGlyph: 'bullhorn',
  },
  create_listing: {
    id: 'create_listing',
    icon: 'tag-plus',
    label: 'List item',
    primaryGlyph: 'tag-plus',
  },
  toggle_visibility: {
    id: 'toggle_visibility',
    icon: 'eye-off',
    label: 'Become visible',
    primaryGlyph: 'eye-off',
  },
  open_pulse: {
    id: 'open_pulse',
    icon: 'pulse',
    label: 'See activity',
    primaryGlyph: 'plus',
  },
};
