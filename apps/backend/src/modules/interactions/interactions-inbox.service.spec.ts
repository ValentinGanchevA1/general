import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import type { InboxItem } from '@g88/shared';

import { InteractionsInboxService } from './interactions-inbox.service';
import { InteractionsService } from './interactions.service';

describe('InteractionsInboxService', () => {
  let service: InteractionsInboxService;
  let query: jest.Mock;
  let listInbox: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    listInbox = jest.fn().mockResolvedValue([]);

    const mod = await Test.createTestingModule({
      providers: [
        InteractionsInboxService,
        {
          provide: getDataSourceToken(),
          useValue: { query } as unknown as DataSource,
        },
        {
          provide: InteractionsService,
          useValue: { listInbox },
        },
      ],
    }).compile();

    service = mod.get(InteractionsInboxService);
  });

  it('merges social, match and gift activity newest-first and applies the final limit', async () => {
    const social: InboxItem = {
      id: 'wave:w1',
      type: 'wave',
      createdAt: '2026-10-20T10:00:00.000Z',
      fromUser: { id: 'wave-user', displayName: 'Wave User', avatarUrl: null },
    };
    listInbox.mockResolvedValue([social]);

    query
      .mockResolvedValueOnce([
        {
          conversation_id: 'c1',
          peer_id: 'match-user',
          display_name: 'Match User',
          avatar_url: null,
          verification_level: 'phone',
          matched_at: new Date('2026-10-20T12:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'g1',
          emoji: '🎁',
          label: 'Gift',
          message: null,
          created_at: new Date('2026-10-20T11:00:00.000Z'),
          sender_id: 'gift-user',
          display_name: 'Gift User',
          avatar_url: null,
          verification_level: null,
        },
      ]);

    const result = await service.list('me', 2);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.type)).toEqual(['match', 'gift']);
    expect(result[0]).toMatchObject({
      id: 'match:c1',
      match: { conversationId: 'c1' },
      isMutual: true,
    });
    expect(result[1]).toMatchObject({
      id: 'gift:g1',
      gift: { emoji: '🎁', label: 'Gift', message: null },
    });
    expect(listInbox).toHaveBeenCalledWith('me', 2);
  });

  it('uses symmetric block filtering and deleted-user filtering for matches and gifts', async () => {
    query.mockResolvedValue([]);

    await service.list('me', 50);

    expect(query).toHaveBeenCalledTimes(2);
    const matchSql = String(query.mock.calls[0]?.[0]);
    const giftSql = String(query.mock.calls[1]?.[0]);

    for (const sql of [matchSql, giftSql]) {
      expect(sql).toContain('user_blocks');
      expect(sql).toContain('blocker_id = $1');
      expect(sql).toContain('blocked_id = $1');
      expect(sql).toContain('u.deleted_at IS NULL');
    }
  });

  it('projects matches only from conversation-linked reciprocal waves and accepted conversations', async () => {
    query.mockResolvedValue([]);

    await service.list('me', 50);

    const matchSql = String(query.mock.calls[0]?.[0]);
    expect(matchSql).toContain('w.conversation_id IS NOT NULL');
    expect(matchSql).toContain("c.status = 'accepted'");
    expect(matchSql).toContain('ORDER BY w.conversation_id, w.created_at DESC');
  });

  it('does not mutate gift seen state while reading the unified inbox', async () => {
    query.mockResolvedValue([]);

    await service.list('me', 50);

    const sql = query.mock.calls.map((call) => String(call[0])).join('\n');
    expect(sql).not.toMatch(/UPDATE\s+gifts/i);
    expect(sql).not.toContain('seen_at =');
  });
});
