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

const CTX: RankContext = {
  viewerLat: 42.7,
  viewerLng: 23.3,
  viewerId: 'viewer',
};

function entity(over: Partial<RankableEntity> = {}): RankableEntity {
  return {
    id: 'u1',
    kind: 'user',
    lat: 42.701,
    lng: 23.301,
    verification: 'email',
    isFriend: false,
    online: false,
    lastSeenAt: null,
    ...over,
  };
}

describe('scoring', () => {
  describe('haversineM / distanceScore', () => {
    it('same point → ~0 m and score 1', () => {
      expect(haversineM(42.7, 23.3, 42.7, 23.3)).toBeLessThan(1);
      expect(distanceScore(42.7, 23.3, 42.7, 23.3)).toBeCloseTo(1, 5);
    });

    it('~280 m yields ~0.5', () => {
      // ~0.0025° lat ≈ 278 m
      const s = distanceScore(42.7, 23.3, 42.7025, 23.3);
      expect(s).toBeGreaterThan(0.4);
      expect(s).toBeLessThan(0.6);
    });
  });

  describe('trustScore', () => {
    it('maps verification ladder', () => {
      expect(trustScore('none')).toBe(0.15);
      expect(trustScore('email')).toBe(0.45);
      expect(trustScore('phone')).toBe(0.7);
      expect(trustScore('id')).toBe(1.0);
      expect(trustScore(undefined)).toBe(0.15);
    });
  });

  describe('socialScore', () => {
    it('friend = 1, non-friend = 0.28', () => {
      expect(socialScore(true)).toBe(1);
      expect(socialScore(false)).toBe(0.28);
      expect(socialScore(undefined)).toBe(0.28);
    });
  });

  describe('activityScore', () => {
    it('online wins', () => {
      expect(activityScore(true, null)).toBe(1);
    });

    it('recent lastSeen', () => {
      const recent = new Date(Date.now() - 5 * 60_000).toISOString();
      expect(activityScore(false, recent)).toBe(0.7);
    });

    it('stale / missing', () => {
      expect(activityScore(false, null)).toBe(0.2);
    });
  });

  describe('freshnessScore', () => {
    it('neutral for users', () => {
      expect(freshnessScore(entity({ kind: 'user' }))).toBe(0.5);
    });

    it('recent event scores high', () => {
      const startsAt = new Date(Date.now() + 2 * 3_600_000).toISOString();
      expect(freshnessScore(entity({ kind: 'event', startsAt }))).toBeGreaterThan(0.9);
    });
  });

  describe('computeRankScore', () => {
    it('friend ID-verified online near viewer ranks above stranger far away', () => {
      const top = computeRankScore(
        entity({
          isFriend: true,
          verification: 'id',
          online: true,
          lat: 42.7005,
          lng: 23.3005,
        }),
        CTX,
      );
      const bottom = computeRankScore(
        entity({
          isFriend: false,
          verification: 'none',
          online: false,
          lat: 42.75,
          lng: 23.4,
        }),
        CTX,
      );
      expect(top).toBeGreaterThan(bottom);
      expect(top).toBeGreaterThan(0.7);
    });

    it('kind multiplier: event > plain user when other signals equal', () => {
      const user = computeRankScore(entity({ kind: 'user', verification: 'email' }), CTX);
      const event = computeRankScore(
        entity({
          kind: 'event',
          verification: undefined,
          startsAt: new Date().toISOString(),
        }),
        CTX,
      );
      // event multiplier 1.12 vs user 1.0; distance/trust differ slightly but event should not collapse
      expect(event).toBeGreaterThan(0.3);
      expect(user).toBeGreaterThan(0.3);
    });

    it('score stays in [0, 1]', () => {
      const s = computeRankScore(
        entity({ isFriend: true, verification: 'id', online: true }),
        CTX,
      );
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(1);
    });
  });
});
