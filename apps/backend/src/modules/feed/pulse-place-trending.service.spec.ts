import { DataSource } from 'typeorm';

import type { PlaceIdentity } from '@g88/shared';

import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';
import { PulsePlaceTrendingService } from './pulse-place-trending.service';

const placeIdentity: PlaceIdentity = {
  provider: 'maptiler',
  providerPlaceId: 'poi.sea-garden',
  canonicalLabel: 'Sea Garden',
  providerCellH3R7: '871ec91a5ffffff',
};
const placeId = '11111111-1111-4111-8111-111111111111';
const baseInput = {
  placeId,
  canonicalLabel: 'Sea Garden',
  locationH3R7: '871ec91a5ffffff',
};

describe('PulsePlaceTrendingService', () => {
  let query: jest.Mock;
  let publishPlaceTrend: jest.Mock;
  let service: PulsePlaceTrendingService;

  beforeEach(() => {
    query = jest.fn();
    publishPlaceTrend = jest.fn().mockResolvedValue(undefined);
    service = new PulsePlaceTrendingService(
      { query } as unknown as DataSource,
      { publishPlaceTrend } as unknown as PulseActivityRealtimeService,
    );
  });

  it('does not emit below the five-distinct-user threshold', async () => {
    query.mockResolvedValueOnce([{ distinct_users: 4 }]);

    await service.evaluateAfterCheckIn({ ...baseInput, placeIdentity });

    expect(query).toHaveBeenCalledTimes(1);
    const countSql = query.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('COUNT(DISTINCT ci.user_id)');
    expect(countSql).toContain("ci.audience = 'nearby'");
    expect(countSql).toContain('ci.place_id = $1');
    expect(countSql).not.toContain('ci.place_provider =');
    expect(query.mock.calls[0]?.[1]).toEqual([placeId, 30]);
    expect(publishPlaceTrend).not.toHaveBeenCalled();
  });

  it('persists NEXA place identity and optional provider metadata', async () => {
    const emittedAt = new Date('2026-10-28T09:00:00.000Z');
    query
      .mockResolvedValueOnce([{ distinct_users: 5 }])
      .mockResolvedValueOnce([{
        id: 'trend-1',
        place_label: 'Sea Garden',
        location_h3_r7: '871ec91a5ffffff',
        last_emitted_at: emittedAt,
      }]);

    await service.evaluateAfterCheckIn({ ...baseInput, placeIdentity });

    const upsertSql = query.mock.calls[1]?.[0] as string;
    expect(upsertSql).toContain('INSERT INTO pulse_place_trends');
    expect(upsertSql).toContain('place_provider, place_provider_id, place_id');
    expect(upsertSql).toContain('ON CONFLICT (place_id) WHERE place_id IS NOT NULL');
    expect(query.mock.calls[1]?.[1]).toEqual([
      `nexa:${placeId}`,
      'Sea Garden',
      '871ec91a5ffffff',
      5,
      'maptiler',
      'poi.sea-garden',
      placeId,
      90,
      120,
    ]);
    expect(publishPlaceTrend).toHaveBeenCalledWith({
      trendId: 'trend-1',
      placeLabel: 'Sea Garden',
      locationH3R7: '871ec91a5ffffff',
      createdAt: emittedAt.toISOString(),
    });
  });

  it('emits a NEXA-native trend without requiring provider aliases', async () => {
    const emittedAt = new Date('2026-10-28T09:05:00.000Z');
    query
      .mockResolvedValueOnce([{ distinct_users: 5 }])
      .mockResolvedValueOnce([{
        id: 'trend-2',
        place_label: 'Sea Garden',
        location_h3_r7: '871ec91a5ffffff',
        last_emitted_at: emittedAt,
      }]);

    await service.evaluateAfterCheckIn({ ...baseInput, placeIdentity: null });

    const params = query.mock.calls[1]?.[1] as unknown[];
    expect(params.slice(0, 7)).toEqual([
      `nexa:${placeId}`,
      'Sea Garden',
      '871ec91a5ffffff',
      5,
      null,
      null,
      placeId,
    ]);
    const upsertSql = query.mock.calls[1]?.[0] as string;
    expect(upsertSql).toContain('COALESCE(EXCLUDED.place_provider');
    expect(publishPlaceTrend).toHaveBeenCalledTimes(1);
  });

  it('does not republish while the durable cooldown suppresses the upsert', async () => {
    query.mockResolvedValueOnce([{ distinct_users: 8 }]).mockResolvedValueOnce([]);
    await service.evaluateAfterCheckIn({ ...baseInput, placeIdentity });
    expect(publishPlaceTrend).not.toHaveBeenCalled();
  });
});
