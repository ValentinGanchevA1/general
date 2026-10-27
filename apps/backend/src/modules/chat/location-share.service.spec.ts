import type { DataSource } from 'typeorm';

import type { ChatService } from './chat.service';
import { LocationShareService } from './location-share.service';

interface SweepRowFixture {
  id: string;
  conversation_id: string;
  ended_at: string;
  end_reason: 'expired' | 'timeout';
}

describe('LocationShareService mutation result handling', () => {
  it('unwraps PostgreSQL mutation tuples for INSERT ... RETURNING', async () => {
    const now = '2026-10-27T16:00:00.000Z';
    const sessionRow = {
      id: 'session-new',
      conversation_id: 'conversation-a',
      sharer_id: 'user-a',
      status: 'active',
      duration: '15m',
      started_at: now,
      ends_at: '2026-10-27T16:15:00.000Z',
      last_lat: 43.2,
      last_lng: 27.9,
      last_updated_at: now,
      ended_at: null,
      end_reason: null,
    };
    const query = jest
      .fn()
      .mockResolvedValueOnce([[], 0])
      .mockResolvedValueOnce([[sessionRow], 1]);
    const persistLocationSession = jest.fn().mockResolvedValue({ id: 'message-a' });
    const chat = {
      isParticipant: jest.fn().mockResolvedValue(true),
      getParticipantIds: jest.fn().mockResolvedValue(['user-a']),
      persistLocationSession,
    } as unknown as ChatService;
    const service = new LocationShareService({ query } as unknown as DataSource, chat);

    const result = await service.start('user-a', 'conversation-a', '15m', {
      lat: 43.2,
      lng: 27.9,
    });

    expect(result.session.id).toBe('session-new');
    expect(result.session.conversationId).toBe('conversation-a');
    expect(result.session.sharerId).toBe('user-a');
    expect(persistLocationSession).toHaveBeenCalledWith(
      'conversation-a',
      'user-a',
      'session-new',
      'Started sharing live location for 15 minutes',
      { lat: 43.2, lng: 27.9 },
    );
  });
});

describe('LocationShareService sweepExpired', () => {
  const makeService = (rows: SweepRowFixture[]) => {
    const query = jest.fn(async (_sql: string, _params?: unknown[]): Promise<unknown> => [rows, rows.length]);
    const db = { query } as unknown as DataSource;
    const chat = {} as ChatService;
    return { service: new LocationShareService(db, chat), query };
  };

  it('claims and closes stale sessions in one bounded atomic query', async () => {
    const endedAt = '2026-10-27T16:00:00.000Z';
    const { service, query } = makeService([
      {
        id: 'session-expired',
        conversation_id: 'conversation-a',
        ended_at: endedAt,
        end_reason: 'expired',
      },
      {
        id: 'session-timeout',
        conversation_id: 'conversation-b',
        ended_at: endedAt,
        end_reason: 'timeout',
      },
    ]);

    const closed = await service.sweepExpired();

    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('WITH candidates AS');
    expect(sql).toContain("WHERE status = 'active'");
    expect(sql).toContain('LIMIT $2');
    expect(sql).toContain('FOR UPDATE SKIP LOCKED');
    expect(sql).toContain("SET status = 'ended'");
    expect(sql).toContain("THEN 'expired'");
    expect(sql).toContain("ELSE 'timeout'");
    expect(sql).toContain("AND s.status = 'active'");
    expect(params?.[1]).toBe(LocationShareService.SWEEP_BATCH_SIZE);

    expect(closed).toEqual([
      {
        id: 'session-expired',
        conversationId: 'conversation-a',
        endedAt,
        reason: 'expired',
      },
      {
        id: 'session-timeout',
        conversationId: 'conversation-b',
        endedAt,
        reason: 'timeout',
      },
    ]);
  });

  it('returns no closures when the mutation tuple reports no rows', async () => {
    const { service, query } = makeService([]);

    await expect(service.sweepExpired()).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
