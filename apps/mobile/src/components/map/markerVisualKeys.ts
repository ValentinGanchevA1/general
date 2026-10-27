import type { ClusterPoint, EntityPoint } from '@g88/shared';

/**
 * Fingerprints of fields that EntityMarker / ClusterMarker actually paint.
 * Used by:
 *   - useTracksViewChanges deps (re-open native snapshot when paint changes)
 *   - React.memo comparators (skip React work when paint is unchanged)
 *
 * Person markers now paint avatar media at standard/selected density, so avatar
 * URL changes must invalidate the native map-marker snapshot. Event/listing
 * media remains intentionally excluded because those markers stay geometry-first.
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
      point.meta.avatarUrl ?? '',
      point.meta.verification,
      point.meta.verifiedBadge === true ? '1' : '0',
      point.meta.online === true ? 'on' : 'off',
    ].join('|');
  }

  if (point.kind === 'event') {
    return [
      point.id,
      point.kind,
      point.meta.title,
      point.meta.startsAt,
    ].join('|');
  }

  return [
    point.id,
    point.kind,
    point.meta.title,
    point.meta.mode ?? 'sell',
    String(point.meta.priceCents),
    point.meta.currency,
  ].join('|');
}
