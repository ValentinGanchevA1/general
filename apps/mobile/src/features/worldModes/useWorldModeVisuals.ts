import { useAppSelector } from '@/hooks/redux';
import { useAppTheme } from '@/theme';

import { WORLD_MODES_ENABLED } from './worldModes';
import { resolveWorldModeVisuals, type WorldModeVisuals } from './worldModeVisuals';

export function useWorldModeVisuals(): WorldModeVisuals {
  const { colors, scheme } = useAppTheme();
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const { selectedId, ownerId, hydrated } = useAppSelector((state) => state.worldModes);
  return resolveWorldModeVisuals({
    id: selectedId,
    ownerId,
    userId,
    hydrated,
    enabled: WORLD_MODES_ENABLED,
    scheme,
    colors,
  });
}