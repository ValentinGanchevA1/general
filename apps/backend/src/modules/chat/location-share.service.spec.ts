import type { DataSource } from 'typeorm';

import type { ChatService } from './chat.service';
import { LocationShareService } from './location-share.service';

interface SweepRowFixture {
  id: string;
  conversation_id: string;
  ended_at: string;
  end_reason: 'expired' | 'timeout';
}

describe('LocationShareService sweepExpired', () => {
  const makeService = (rows: SweepRowFixture[]) => {
    const query = jest.fn(async (_sql: string, _params?: unknown[]): Promise<SweepRowFixture[]> => rows);
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

  it('returns no closures when no active candidate is claimed', async () => {
    const { service, query } = makeService([]);

    await expect(service.sweepExpired()).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(1);
  });
});
