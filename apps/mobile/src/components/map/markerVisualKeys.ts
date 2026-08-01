import type { ClusterPoint, EntityPoint } from '@g88/shared';

/**
 * Fingerprints of fields that EntityMarker / ClusterMarker actually paint.
 * Used by:
 *   - useTracksViewChanges deps (re-open native snapshot when paint changes)
 *   - React.memo comparators (skip React work when paint is unchanged)
 */

export function clusterVisualKey(point: ClusterPoint): string {
  const by = point.by;
  return [
    point.count,
    by.user ?? 0,
    by.event ?? 0,
    by.listing ?? 0,
  ].join('|');
}

export function entityVisualKey(point: EntityPoint): string {
  if (point.kind === 'user') {
    return [
      point.id,
      point.meta.displayName,
      point.meta.verification,
      point.meta.verifiedBadge === true ? '1' : '0',
    ].join('|');
  }
  return [point.id, point.kind, point.meta.title].join('|');
}
