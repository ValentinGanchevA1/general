import type { EntityPoint, PlaceMapEntityPoint } from '@g88/shared';

import type { TrendingItem } from './buildTrending';
import { mergeTrendingWithPublicPlace } from './placeTrendingRows';

const USER_POINT: EntityPoint = {
  kind: 'user',
  id: 'user-1',
  lat: 43.2,
  lng: 27.9,
  meta: {
    displayName: 'Maria',
    avatarUrl: null,
    verification: 'none',
    online: false,
    lastSeenAt: null,
  },
};

const EVENT_POINT: EntityPoint = {
  kind: 'event',
  id: 'event-1',
  lat: 43.21,
  lng: 27.91,
  meta: {
    title: 'Sunset Meetup',
    startsAt: '2026-11-01T18:00:00.000Z',
    category: null,
    participantCount: 8,
  },
};

const LEGACY: TrendingItem[] = [
  {
    id: USER_POINT.id,
    kind: USER_POINT.kind,
    title: 'Maria',
    distanceM: 120,
    score: 94,
    point: USER_POINT,
  },
  {
    id: EVENT_POINT.id,
    kind: EVENT_POINT.kind,
    title: 'Sunset Meetup',
    distanceM: 450,
    score: 88,
    point: EVENT_POINT,
  },
];

const PLACE: PlaceMapEntityPoint = {
  kind: 'place',
  id: 'place-1',
  lat: 43.207,
  lng: 27.927,
  meta: {
    canonicalLabel: 'Sea Garden',
    trending: true,
    recentActivityAt: '2026-11-01T17:58:00.000Z',
    locationPrecision: 'coarse',
  },
};

const NOW = Date.parse('2026-11-01T18:00:00.000Z');

describe('mergeTrendingWithPublicPlace', () => {
  it('keeps the top legacy entity first and inserts one public Place', () => {
    const rows = mergeTrendingWithPublicPlace(LEGACY, [PLACE], 3, NOW);

    expect(rows.map((row) => row.kind)).toEqual(['user', 'place', 'event']);
    expect(rows[1]).toMatchObject({
      id: 'place-1',
      title: 'Sea Garden',
      activityLabel: 'Active moments ago',
    });
  });

  it('shows a public Place when no legacy trending rows exist', () => {
    const rows = mergeTrendingWithPublicPlace([], [PLACE], 3, NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.kind).toBe('place');
  });

  it('adds at most one Place candidate and respects the row limit', () => {
    const secondPlace: PlaceMapEntityPoint = {
      ...PLACE,
      id: 'place-2',
      meta: { ...PLACE.meta, canonicalLabel: 'Port' },
    };

    const rows = mergeTrendingWithPublicPlace(LEGACY, [PLACE, secondPlace], 2, NOW);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.id)).toEqual(['user-1', 'place-1']);
  });

  it('falls back to generic active copy instead of exposing a stale timestamp', () => {
    const stalePlace: PlaceMapEntityPoint = {
      ...PLACE,
      meta: {
        ...PLACE.meta,
        recentActivityAt: '2026-11-01T12:00:00.000Z',
      },
    };

    const rows = mergeTrendingWithPublicPlace([], [stalePlace], 3, NOW);

    expect(rows[0]).toMatchObject({ activityLabel: 'Getting active nearby' });
  });
});
