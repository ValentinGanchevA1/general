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

  it('batch-filters event delta recipients with current bilateral blocks and visibility', async () => {
    query.mockResolvedValueOnce([{ viewer_id: viewerId }]);

    await expect(service.authorizedViewerIds(eventId, [viewerId, viewerId, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc']))
      .resolves.toEqual(new Set([viewerId]));

    const [sql, params] = query.mock.calls[0] as [string, unknown[]];
    expect(params).toEqual([eventId, [viewerId, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'], null, null]);
    expect(sql).toContain('FROM unnest($2::uuid[])');
    expect(sql).toContain('e.deleted_at IS NULL');
    expect(sql).toContain("e.visibility = 'public' OR e.host_id = viewers.viewer_id");
    expect(sql).toContain('ub.blocker_id = viewers.viewer_id AND ub.blocked_id = e.host_id');
    expect(sql).toContain('ub.blocker_id = e.host_id AND ub.blocked_id = viewers.viewer_id');
  });

  it('enforces question-author block isolation for new questions and upvote deltas', async () => {
    const authorId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    const questionId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(service.authorizedViewerIds(eventId, [viewerId], { authorId })).resolves.toEqual(new Set());
    await expect(service.authorizedViewerIds(eventId, [viewerId], { questionId })).resolves.toEqual(new Set());

    const [newQuestionSql, newQuestionParams] = query.mock.calls[0] as [string, unknown[]];
    expect(newQuestionParams).toEqual([eventId, [viewerId], authorId, null]);
    expect(newQuestionSql).toContain('qb.blocker_id = viewers.viewer_id');
    expect(newQuestionSql).toContain('qb.blocker_id = COALESCE($3::uuid, q.user_id)');
    const [upvoteSql, upvoteParams] = query.mock.calls[1] as [string, unknown[]];
    expect(upvoteParams).toEqual([eventId, [viewerId], null, questionId]);
    expect(upvoteSql).toContain('q.id = $4::uuid AND q.event_id = e.id');
    expect(upvoteSql).toContain('($4::uuid IS NULL OR q.id IS NOT NULL)');
  });

  it('skips the database for empty recipient sets and invalid event keys', async () => {
    await expect(service.authorizedViewerIds(eventId, [])).resolves.toEqual(new Set());
    await expect(service.authorizedViewerIds('', [viewerId])).resolves.toEqual(new Set());
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects the entire delivery query when access cannot be verified', async () => {
    query.mockRejectedValueOnce(new Error('authorization DB unavailable'));
    await expect(service.authorizedViewerIds(eventId, [viewerId])).rejects.toThrow('authorization DB unavailable');
  });

  it('propagates authorization database errors to the gateway fail-closed path', async () => {
    query.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.canView(viewerId, eventId)).rejects.toThrow('database unavailable');
  });
});
