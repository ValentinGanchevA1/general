import { DataSource } from 'typeorm';

import { PulseActivityRealtimeService } from '../feed/pulse-activity-realtime.service';
import { EventPulseShareService } from './event-pulse-share.service';

describe('EventPulseShareService', () => {
  let query: jest.Mock;
  let publishEventJoin: jest.Mock;
  let removeEventJoin: jest.Mock;
  let service: EventPulseShareService;

  beforeEach(() => {
    query = jest.fn();
    publishEventJoin = jest.fn().mockResolvedValue(undefined);
    removeEventJoin = jest.fn().mockResolvedValue(undefined);
    service = new EventPulseShareService(
      { query } as unknown as DataSource,
      { publishEventJoin, removeEventJoin } as unknown as PulseActivityRealtimeService,
    );
  });

  it('persists explicit consent before publishing the event join', async () => {
    const sharedAt = '2026-10-28T01:15:00.123Z';
    query.mockResolvedValueOnce([{
      event_id: 'event-1',
      title: 'Sunset Meetup',
      host_id: 'host-1',
      location_h3_r7: '871ec91a5ffffff',
      pulse_shared_at_iso: sharedAt,
    }]);

    const result = await service.shareJoin('user-1', 'event-1');

    expect(result).toEqual({
      eventId: 'event-1',
      sharedAt,
      alreadyShared: false,
    });
    const updateSql = query.mock.calls[0]?.[0] as string;
    expect(updateSql).toContain('WITH updated AS (');
    expect(updateSql).toContain("a.status = 'going'");
    expect(updateSql).toContain("e.visibility = 'public'");
    expect(updateSql).toContain('e.starts_at > NOW()');
    expect(updateSql).toContain("a.pulse_shared_at AT TIME ZONE 'UTC'");
    expect(updateSql).toContain('AS pulse_shared_at_iso');
    expect(updateSql).toContain('SELECT * FROM updated');
    expect(publishEventJoin).toHaveBeenCalledWith({
      eventId: 'event-1',
      actorId: 'user-1',
      eventTitle: 'Sunset Meetup',
      eventHostId: 'host-1',
      locationH3R7: '871ec91a5ffffff',
      createdAt: sharedAt,
    });
  });

  it('is idempotent when the join was already shared', async () => {
    const sharedAt = '2026-10-28T01:15:00.123Z';
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        title: 'Sunset Meetup',
        host_id: 'host-1',
        location_h3_r7: '871ec91a5ffffff',
        visibility: 'public',
        is_upcoming: true,
        deleted_at: null,
        status: 'going',
        pulse_shared_at_iso: sharedAt,
      }]);

    await expect(service.shareJoin('user-1', 'event-1')).resolves.toEqual({
      eventId: 'event-1',
      sharedAt,
      alreadyShared: true,
    });
    const stateSql = query.mock.calls[1]?.[0] as string;
    expect(stateSql).toContain('e.starts_at > NOW() AS is_upcoming');
    expect(stateSql).toContain("a.pulse_shared_at AT TIME ZONE 'UTC'");
    expect(stateSql).toContain('AS pulse_shared_at_iso');
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
        is_upcoming: true,
        deleted_at: null,
        status: 'going',
        pulse_shared_at_iso: null,
      }]);

    await expect(service.shareJoin('user-1', 'event-1')).rejects.toMatchObject({ status: 409 });
    expect(publishEventJoin).not.toHaveBeenCalled();
  });

  it('rejects ended events using database time semantics', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{
        title: 'Ended Meetup',
        host_id: 'host-1',
        location_h3_r7: '871ec91a5ffffff',
        visibility: 'public',
        is_upcoming: false,
        deleted_at: null,
        status: 'going',
        pulse_shared_at_iso: null,
      }]);

    await expect(service.shareJoin('user-1', 'event-1')).rejects.toMatchObject({
      status: 409,
      response: expect.objectContaining({ code: 'event.pulse_not_upcoming' }),
    });
    expect(publishEventJoin).not.toHaveBeenCalled();
  });

  it('keeps a durable share successful when realtime delivery fails', async () => {
    query.mockResolvedValueOnce([{
      event_id: 'event-1',
      title: 'Sunset Meetup',
      host_id: 'host-1',
      location_h3_r7: '871ec91a5ffffff',
      pulse_shared_at_iso: '2026-10-28T01:15:00.123Z',
    }]);
    publishEventJoin.mockRejectedValueOnce(new Error('redis unavailable'));

    await expect(service.shareJoin('user-1', 'event-1')).resolves.toMatchObject({
      eventId: 'event-1',
      alreadyShared: false,
    });
  });

  it('prepares revocation only when the Going RSVP was explicitly shared', async () => {
    query.mockResolvedValueOnce([{
      event_id: 'event-1',
      host_id: 'host-1',
      location_h3_r7: '871ec91a5ffffff',
    }]);

    await expect(service.prepareJoinRevocation('user-1', 'event-1')).resolves.toEqual({
      eventId: 'event-1',
      actorId: 'user-1',
      eventHostId: 'host-1',
      locationH3R7: '871ec91a5ffffff',
    });
    const sql = query.mock.calls[0]?.[0] as string;
    expect(sql).toContain("a.status = 'going'");
    expect(sql).toContain('a.pulse_shared_at IS NOT NULL');
    expect(sql).toContain("e.visibility = 'public'");
  });

  it('publishes a prepared revocation without making RSVP success depend on realtime', () => {
    removeEventJoin.mockRejectedValueOnce(new Error('redis unavailable'));
    expect(() => service.revokePreparedJoin({
      eventId: 'event-1',
      actorId: 'user-1',
      eventHostId: 'host-1',
      locationH3R7: '871ec91a5ffffff',
    })).not.toThrow();
    expect(removeEventJoin).toHaveBeenCalledTimes(1);
  });
});
