import type { EntityPoint } from '@g88/shared';

import type { NexaMarkerDensity } from './nexaEntityMarkerVisuals';

/**
 * Avatar media is intentionally suppressed for compact overview markers to avoid
 * a burst of remote image work while the map is dense. A selected person may
 * still show their avatar so the focused entity remains recognizable.
 */
export function resolvePersonMarkerAvatarUrl(
  point: EntityPoint,
  density: NexaMarkerDensity,
  selected: boolean,
): string | null {
  if (point.kind !== 'user') return null;
  if (density === 'compact' && !selected) return null;

  const avatarUrl = point.meta.avatarUrl?.trim();
  return avatarUrl ? avatarUrl : null;
}
