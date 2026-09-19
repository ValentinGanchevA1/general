import {
  activityScore,
  computeRankScore,
  distanceScore,
  freshnessScore,
  haversineM,
  socialScore,
  trustScore,
  type RankableEntity,
  type RankContext,
} from './scoring';

describe('discovery ranking scoring', () => {
  const ctx: RankContext = {
    viewerLat: 42.7,
    viewerLng: 23.3,
    viewerId: 'viewer',
  };

  it('haversine is ~0 at same point and increases with separation', () => {
    expect(haversineM(42.7, 23.3, 42.7, 23.3)).toBeLessThan(1);
    expect(haversineM(42.7, 23.3, 42.71, 23.3)).toBeGreaterThan(1000);
  });

  it('distanceScore is 1 at zero distance and decays', () => {
    expect(distanceScore(42.7, 23.3, 42.7, 23.3)).toBeCloseTo(1, 5);
    expect(distanceScore(42.7, 23.3, 42.71, 23.3)).toBeLessThan(0.6);
  });

  it('trustScore follows verification ladder', () => {
    expect(trustScore('none')).toBeLessThan(trustScore('email'));
    expect(trustScore('email')).toBeLessThan(trustScore('phone'));
    expect(trustScore('phone')).toBeLessThan(trustScore('id'));
    expect(trustScore(undefined)).toBe(trustScore('none'));
  });

  it('socialScore prioritizes friends', () => {
    expect(socialScore(true)).toBe(1);
    expect(socialScore(false)).toBeLessThan(0.5);
    expect(socialScore(undefined)).toBe(socialScore(false));
  });

  it('activityScore: online > recent lastSeen > cold', () => {
    expect(activityScore(true, null)).toBe(1);
    const fiveMin = new Date(Date.now() - 5 * 60_000).toISOString();
    const hour = new Date(Date.now() - 45 * 60_000).toISOString();
    expect(activityScore(false, fiveMin)).toBe(0.7);
    expect(activityScore(false, hour)).toBe(0.4);
    expect(activityScore(false, null)).toBe(0.2);
  });

  it('freshnessScore decays old listings', () => {
    const listing: RankableEntity = {
      id: 'l1',
      kind: 'listing',
      lat: 42.7,
      lng: 23.3,
      createdAt: new Date(Date.now() - 10 * 24 * 3600_000).toISOString(),
    };
    const fresh: RankableEntity = {
      ...listing,
      createdAt: new Date().toISOString(),
    };
    expect(freshnessScore(fresh)).toBeGreaterThan(freshnessScore(listing));
  });

  it('computeRankScore ranks nearby online friend above distant stranger', () => {
    const friend: RankableEntity = {
      id: 'f1',
      kind: 'user',
      lat: 42.7005,
      lng: 23.3005,
      verification: 'phone',
      isFriend: true,
      online: true,
    };
    const stranger: RankableEntity = {
      id: 's1',
      kind: 'user',
      lat: 42.75,
      lng: 23.35,
      verification: 'none',
      isFriend: false,
      online: false,
      lastSeenAt: null,
    };
    expect(computeRankScore(friend, ctx)).toBeGreaterThan(computeRankScore(stranger, ctx));
  });

  it('computeRankScore is bounded to [0, 1]', () => {
    const e: RankableEntity = {
      id: 'u1',
      kind: 'user',
      lat: 42.7,
      lng: 23.3,
      verification: 'id',
      isFriend: true,
      online: true,
    };
    const score = computeRankScore(e, ctx);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });
});
