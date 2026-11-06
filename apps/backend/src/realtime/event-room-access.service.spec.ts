import type { DataSource } from 'typeorm';

import { EventRoomAccessService } from './event-room-access.service';

const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const viewerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('EventRoomAccessService', () => {
  const query = jest.fn();
  let service: EventRoomAccessService;

  beforeEach(() => {
    query.mockReset();
    service = new EventRoomAccessService({ query } as unknown as DataSource);
  });

  it('uses the event detail visibility and bilateral block rules', async () => {
    query.mockResolvedValueOnce([{ id: eventId }]);

    await expect(service.canView(viewerId, eventId)).resolves.toBe(true);

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([eventId, viewerId]);
    expect(sql).toContain("e.deleted_at IS NULL");
    expect(sql).toContain("e.visibility = 'public' OR e.host_id = $2");
    expect(sql).toContain('ub.blocker_id = $2 AND ub.blocked_id = e.host_id');
    expect(sql).toContain('ub.blocker_id = e.host_id AND ub.blocked_id = $2');
  });

  it('rejects missing, deleted, private, or blocked events when DB returns no rows', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.canView(viewerId, eventId)).resolves.toBe(false);
  });

  it('fails closed for an unauthenticated or missing event id', async () => {
    await expect(service.canView('', eventId)).resolves.toBe(false);
    await expect(service.canView(viewerId, '')).resolves.toBe(false);
    expect(query).not.toHaveBeenCalled();
  });

  it('propagates authorization database errors to the gateway fail-closed path', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.canView(viewerId, eventId)).rejects.toThrow('database unavailable');
  });
});
