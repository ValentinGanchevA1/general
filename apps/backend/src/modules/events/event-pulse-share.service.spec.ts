import { DataSource } from 'typeorm';

import { PulseActivityRealtimeService } from '../feed/pulse-activity-realtime.service';
import { EventPulseShareService } from './event-pulse-share.service';

describe('EventPulseShareService', () => {
  let query: jest.Mock;
  let publishEventJoin: jest.Mock;
  let service: EventPulseShareService;

  beforeEach(() => {
    query = jest.fn();
    publishEventJoin = jest.fn().mockResolvedValue(undefined);
    service = new EventPulseShareService(
      { query } as unknown as DataSource,
      { publishEventJoin } as unknown as PulseActivityRealtimeService,
    );
  });

  it('persists explicit consent before publishing the event join', async () => {
    const sharedAt = new Date('2026-10-28T01:15:00.000Z');
    query.mockResolvedValueOnce([{
      event_id: 'event-1',
      title: 'Sunset Meetup',
      host_id: 'host-1',
      location_h3_r7: '871ec91a5ffffff',
      pulse_shared_at: sharedAt,
    }]);

    const result = await service.shareJoin('user-1', 'event-1');

    expect(result).toEqual({
      eventId: 'event-1',
      sharedAt: sharedAt.toISOString(),
      alreadyShared: false,
    });
    const updateSql = query.mock.calls[0]?.[0] as string;
    expect(updateSql).toContain("a.status = 'going'");
    expect(updateSql).toContain("e.visibility = 'public'");
    expect(updateSql).toContain('e.starts_at > NOW()');
    expect(publishEventJoin).toHaveBeenCalledWith({
      eventId: 'event-1',
      actorId: 'user-1',
      eventTitle: 'Sunset Meetup',
      eventHostId: 'host-1',
      locationH3R7: '871ec91a5ffffff',
      createdAt: sharedAt.toISOString(),
    });
  });

  it('is idempotent when the join was already shared', async () => {
    const sharedAt = new Date('2026-10-28T01:15:00.000Z');
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        title: 'Sunset Meetup',
        host_id: 'host-1',
        location_h3_r7: '871ec91a5ffffff',
        visibility: 'public',
        starts_at: new Date(Date.now() + 60_000),
        deleted_at: null,
        status: 'going',
        pulse_shared_at: sharedAt,
      }]);

    await expect(service.shareJoin('user-1', 'event-1')).resolves.toEqual({
      eventId: 'event-1',
      sharedAt: sharedAt.toISOString(),
      alreadyShared: true,
    });
    expect(publishEventJoin).not.toHaveBeenCalled();
  });

  it('does not allow private event attendance to leak into Pulse', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        title: 'Private Meetup',
        host_id: 'host-1',
        location_h3_r7: '871ec91a5ffffff',
        visibility: 'private',
        starts_at: new Date(Date.now() + 60_000),
        deleted_at: null,
        status: 'going',
        pulse_shared_at: null,
      }]);

    await expect(service.shareJoin('user-1', 'event-1')).rejects.toMatchObject({ status: 409 });
    expect(publishEventJoin).not.toHaveBeenCalled();
  });

  it('keeps a durable share successful when realtime delivery fails', async () => {
    query.mockResolvedValueOnce([{
      event_id: 'event-1',
      title: 'Sunset Meetup',
      host_id: 'host-1',
      location_h3_r7: '871ec91a5ffffff',
      pulse_shared_at: new Date('2026-10-28T01:15:00.000Z'),
    }]);
    publishEventJoin.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.shareJoin('user-1', 'event-1')).resolves.toMatchObject({
      eventId: 'event-1',
      alreadyShared: false,
    });
  });
});
