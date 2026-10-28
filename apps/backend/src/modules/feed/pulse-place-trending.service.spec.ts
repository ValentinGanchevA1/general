import { DataSource } from 'typeorm';

import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';
import { PulsePlaceTrendingService } from './pulse-place-trending.service';

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

    await service.evaluateAfterCheckIn({
      placeLabel: 'Sea Garden',
      locationH3R7: '871ec91a5ffffff',
    });

    expect(query).toHaveBeenCalledTimes(1);
    const countSql = query.mock.calls[0]?.[0] as string;
    expect(countSql).toContain('COUNT(DISTINCT ci.user_id)');
    expect(countSql).toContain("ci.audience = 'nearby'");
    expect(query.mock.calls[0]?.[1]).toEqual([
      'Sea Garden',
      '871ec91a5ffffff',
      30,
    ]);
    expect(publishPlaceTrend).not.toHaveBeenCalled();
  });

  it('persists and publishes only a threshold-passed anonymous aggregate', async () => {
    const emittedAt = new Date('2026-10-28T09:00:00.000Z');
    query
      .mockResolvedValueOnce([{ distinct_users: 5 }])
      .mockResolvedValueOnce([{
        id: 'trend-1',
        place_label: 'Sea Garden',
        location_h3_r7: '871ec91a5ffffff',
        last_emitted_at: emittedAt,
      }]);

    await service.evaluateAfterCheckIn({
      placeLabel: 'Sea Garden',
      locationH3R7: '871ec91a5ffffff',
    });

    const upsertSql = query.mock.calls[1]?.[0] as string;
    expect(upsertSql).toContain('INSERT INTO pulse_place_trends');
    expect(upsertSql).toContain('ON CONFLICT (place_key, location_h3_r7)');
    expect(query.mock.calls[1]?.[1]).toEqual([
      'Sea Garden',
      '871ec91a5ffffff',
      5,
      90,
      120,
    ]);
    expect(publishPlaceTrend).toHaveBeenCalledWith({
      trendId: 'trend-1',
      placeLabel: 'Sea Garden',
      locationH3R7: '871ec91a5ffffff',
      createdAt: emittedAt.toISOString(),
    });

    const publishInput = publishPlaceTrend.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(publishInput).not.toHaveProperty('distinctUserCount');
    expect(publishInput).not.toHaveProperty('participantIds');
  });

  it('does not republish while the durable cooldown suppresses the upsert', async () => {
    query
      .mockResolvedValueOnce([{ distinct_users: 8 }])
      .mockResolvedValueOnce([]);

    await service.evaluateAfterCheckIn({
      placeLabel: 'Sea Garden',
      locationH3R7: '871ec91a5ffffff',
    });

    expect(publishPlaceTrend).not.toHaveBeenCalled();
  });
});
