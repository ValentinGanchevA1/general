import type { MapClusterPoint, MapEntityPoint } from '@g88/shared';

/** Paint-only fingerprints used by map marker memoization. */
export function clusterVisualKey(point: MapClusterPoint): string {
  const by = point.by;
  return [
    point.count,
    by.user ?? 0,
    by.event ?? 0,
    by.listing ?? 0,
    by.place ?? 0,
  ].join('|');
}

export function entityVisualKey(point: MapEntityPoint): string {
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

  if (point.kind === 'place') {
    return [
      point.id,
      point.kind,
      point.meta.canonicalLabel,
      point.meta.trending ? 'active' : 'idle',
      point.meta.saved === true ? 'saved' : 'public',
      point.meta.recentActivityAt ?? '',
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
