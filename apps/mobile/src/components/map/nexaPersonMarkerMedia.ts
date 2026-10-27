import type { EntityPoint } from '@g88/shared';

import type { NexaMarkerDensity } from './nexaEntityMarkerVisuals';

/**
 * Keep a person's identity stable while zoom density changes.
 * Discovery media is already prefetched at MapScreen level, while marker count
 * and progressive reveal are bounded separately. Swapping compact markers back
 * to initials caused visible avatar -> fallback -> avatar churn on Android.
 */
export function resolvePersonMarkerAvatarUrl(
  point: EntityPoint,
  _density: NexaMarkerDensity,
  _selected: boolean,
): string | null {
  if (point.kind !== 'user') return null;

  const avatarUrl = point.meta.avatarUrl?.trim();
  return avatarUrl ? avatarUrl : null;
}
