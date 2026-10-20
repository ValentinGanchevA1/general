import React from 'react';
import type { EntityPoint } from '@g88/shared';

import { NexaEntityMarker } from './NexaEntityMarker';
import { entityVisualKey } from './markerVisualKeys';

interface Props {
  point: EntityPoint;
  selected?: boolean;
  isNew?: boolean;
  own?: boolean;
  dimmed?: boolean;
  unavailable?: boolean;
  onVisualSettled?: () => void;
}

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((word) => word[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatEventBadge(startsAt: string): string {
  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return 'Event';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfEvent = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startOfEvent.getTime() - startOfToday.getTime()) / 86_400_000,
  );

  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const time = `${hh}:${mm}`;

  if (dayDiff === 0) return `Today ${time}`;
  if (dayDiff === 1) return `Tmrw ${time}`;
  if (dayDiff > 1 && dayDiff < 7) {
    return `${date.toLocaleDateString(undefined, { weekday: 'short' })} ${time}`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatListingBadge(
  priceCents: number,
  currency: string,
  mode: string | undefined,
): string {
  if (mode === 'buy') return 'Wanted';

  const code = (currency || 'EUR').toUpperCase();
  const amount = priceCents / 100;

  if (code === 'EUR') {
    if (amount >= 1000) return `€${Math.round(amount / 100) / 10}k`;
    if (Number.isInteger(amount)) return `€${amount}`;
    return `€${amount.toFixed(2)}`;
  }

  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: code,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${code} ${amount}`;
  }
}

function EntityMarkerImpl({
  point,
  selected = false,
  isNew = false,
  own = false,
  dimmed = false,
  unavailable = false,
  onVisualSettled,
}: Props): React.JSX.Element {
  if (point.kind === 'user') {
    const verified =
      point.meta.verifiedBadge === true || point.meta.verification === 'id';
    const live = point.meta.online === true;
    const name = point.meta.displayName;

    return (
      <NexaEntityMarker
        entityType="person"
        label={initialsFromName(name) || '?'}
        caption={name.slice(0, 10)}
        state={{ selected, live, verified, isNew, own, dimmed, unavailable }}
        accessibilityLabel={`${name}, person${live ? ', live' : ''}${verified ? ', verified' : ''}`}
        onVisualSettled={onVisualSettled}
      />
    );
  }

  if (point.kind === 'event') {
    return (
      <NexaEntityMarker
        entityType="event"
        caption={formatEventBadge(point.meta.startsAt)}
        state={{ selected, isNew, own, dimmed, unavailable }}
        accessibilityLabel={`${point.meta.title}, event`}
        onVisualSettled={onVisualSettled}
      />
    );
  }

  return (
    <NexaEntityMarker
      entityType="listing"
      caption={formatListingBadge(
        point.meta.priceCents,
        point.meta.currency,
        point.meta.mode,
      )}
      state={{ selected, isNew, own, dimmed, unavailable }}
      accessibilityLabel={`${point.meta.title}, listing`}
      onVisualSettled={onVisualSettled}
    />
  );
}

function entityMarkerPropsEqual(prev: Props, next: Props): boolean {
  return (
    entityVisualKey(prev.point) === entityVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng &&
    prev.selected === next.selected &&
    prev.isNew === next.isNew &&
    prev.own === next.own &&
    prev.dimmed === next.dimmed &&
    prev.unavailable === next.unavailable &&
    prev.onVisualSettled === next.onVisualSettled
  );
}

export const EntityMarker = React.memo(EntityMarkerImpl, entityMarkerPropsEqual);
