import * as h3 from 'h3-js';
import { DataSource } from 'typeorm';

import type { ActivityItem } from '@g88/shared';

import { FeedService } from './feed.service';
import { PulseDiscoveryFeedService } from './pulse-discovery-feed.service';

describe('PulseDiscoveryFeedService check-ins', () => {
  it('applies audience/block filters and renders place_visit narrative', async () => {
    const viewerCell = h3.latLngToCell(43.2047, 27.9105, 7);
    const query = jest.fn()
      .mockResolvedValueOnce([{ location_h3_r7: viewerCell }])
      .mockResolvedValueOnce([{
        id: 'check-in-1',
        user_id: 'friend-1',
        display_name: 'Valentin',
        place_label: 'Sea Garden',
        audience: 'friends',
        location_h3_r7: viewerCell,
        created_at: new Date('2026-10-27T18:00:00.000Z'),
      }]);
    const db = { query } as unknown as DataSource;
    const legacyFeed = { aggregate: jest.fn() } as unknown as FeedService;
    const service = new PulseDiscoveryFeedService(db, legacyFeed);

    const result = await service.aggregate(
      'viewer-1',
      new Date('2026-10-27T17:00:00.000Z'),
      ['place'],
      20,
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: 'place:check-in-1',
      type: 'place',
      actorName: 'Valentin',
      narrative: {
        kind: 'place_visit',
        verb: 'visited',
        objectLabel: 'Sea Garden',
      },
    });

    const checkInSql = query.mock.calls[1]?.[0] as string;
    expect(checkInSql).toContain('user_blocks');
    expect(checkInSql).toContain('friendships');
    expect(checkInSql).toContain("ci.audience = 'nearby'");
    expect(checkInSql).toContain("ci.audience = 'friends'");
  });
});

describe('PulseDiscoveryFeedService event joins', () => {
  it('returns only explicitly shared public upcoming joins with block gates', async () => {
    const viewerCell = h3.latLngToCell(43.2047, 27.9105, 7);
    const query = jest.fn()
      .mockResolvedValueOnce([{ location_h3_r7: viewerCell }])
      .mockResolvedValueOnce([{
        event_id: 'event-1',
        event_title: 'Sunset Meetup',
        host_id: 'host-1',
        user_id: 'user-2',
        display_name: 'Maria',
        pulse_shared_at: new Date('2026-10-28T01:15:00.000Z'),
        distance_m: 420,
      }]);
    const service = new PulseDiscoveryFeedService(
      { query } as unknown as DataSource,
      { aggregate: jest.fn() } as unknown as FeedService,
    );
    const internal = service as unknown as {
      selectEventJoins: (userId: string, since: Date, limit: number) => Promise<ActivityItem[]>;
    };

    const items = await internal.selectEventJoins(
      'viewer-1',
      new Date('2026-10-28T01:00:00.000Z'),
      20,
    );

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: 'event_join:event-1:user-2',
      type: 'event',
      actorName: 'Maria',
      distanceM: 420,
      narrative: {
        kind: 'event_joined',
        verb: 'joined',
        objectLabel: 'Sunset Meetup',
      },
    });

    const sql = query.mock.calls[1]?.[0] as string;
    expect(sql).toContain('a.pulse_shared_at IS NOT NULL');
    expect(sql).toContain("e.visibility = 'public'");
    expect(sql).toContain('e.starts_at > NOW()');
    expect(sql.match(/user_blocks/g)).toHaveLength(2);
  });
});
