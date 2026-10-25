import type { DiscoveryPoint } from '@g88/shared';

import reducer, {
  removePoint,
  setPoints,
  upsertPoint,
} from '../discoverySlice';

const user: DiscoveryPoint = {
  kind: 'user',
  id: 'u1',
  lat: 43.21,
  lng: 27.91,
  rankScore: 1,
  meta: {
    displayName: 'User',
    avatarUrl: null,
    verification: 'none',
    online: false,
    lastSeenAt: null,
    verifiedBadge: false,
    isFriend: false,
  },
};

const listing: DiscoveryPoint = {
  kind: 'listing',
  id: 'u1',
  lat: 43.22,
  lng: 27.92,
  rankScore: 0.5,
  meta: {
    title: 'Listing',
    thumbnailUrl: null,
    priceCents: 1000,
    currency: 'BGN',
    category: 'other',
    mode: 'sell',
    sellerId: 'seller-1',
    sellerDisplayName: 'Seller',
    createdAt: '2026-10-25T00:00:00.000Z',
    expiresAt: null,
    bumpedAt: null,
  },
};

describe('discovery realtime point reducers', () => {
  it('upserts by canonical kind-aware key', () => {
    const seeded = reducer(undefined, setPoints([user, listing]));
    const movedUser: DiscoveryPoint = { ...user, lat: 43.211 };

    const updated = reducer(seeded, upsertPoint(movedUser));

    expect(updated.points).toHaveLength(2);
    expect(updated.points[0]).toEqual(movedUser);
    expect(updated.points[1]).toEqual(listing);
  });

  it('adds an entering point without replacing a different kind with the same id', () => {
    const seeded = reducer(undefined, setPoints([user]));

    const updated = reducer(seeded, upsertPoint(listing));

    expect(updated.points).toEqual([user, listing]);
  });

  it('removes only the canonical entity key and ignores stale leave events', () => {
    const seeded = reducer(undefined, setPoints([user, listing]));
    const removed = reducer(seeded, removePoint('user:u1'));
    const unchanged = reducer(removed, removePoint('event:missing'));

    expect(removed.points).toEqual([listing]);
    expect(unchanged).toBe(removed);
  });
});
