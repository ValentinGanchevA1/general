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
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: InteractionsService, useValue: { listInbox } },
      ],
    }).compile();

    service = mod.get(InteractionsInboxService);
  });

  it('merges social, match, gift and notification activity newest-first and applies the final limit', async () => {
    const social: InboxItem = {
      id: 'wave:w1',
      type: 'wave',
      createdAt: '2026-10-20T09:00:00.000Z',
      fromUser: { id: 'wave-user', displayName: 'Wave User', avatarUrl: null },
    };
    listInbox.mockResolvedValue([social]);

    query
      .mockResolvedValueOnce([{
        conversation_id: 'c1', peer_id: 'match-user', display_name: 'Match User',
        avatar_url: null, verification_level: 'phone',
        matched_at: new Date('2026-10-20T12:00:00.000Z'),
      }])
      .mockResolvedValueOnce([{
        id: 'g1', emoji: '🎁', label: 'Gift', message: null,
        created_at: new Date('2026-10-20T10:00:00.000Z'), sender_id: 'gift-user',
        display_name: 'Gift User', avatar_url: null, verification_level: null,
      }])
      .mockResolvedValueOnce([{
        id: 'n1', kind: 'friend_accepted',
        destination: { type: 'profile', userId: 'friend-user' },
        created_at: new Date('2026-10-20T11:00:00.000Z'), actor_id: 'friend-user',
        display_name: 'Friend User', avatar_url: null, verification_level: null,
      }]);

    const result = await service.list('me', 3);

    expect(result).toHaveLength(3);
    expect(result.map((item) => item.type)).toEqual(['match', 'notification', 'gift']);
    expect(result[0]).toMatchObject({ id: 'match:c1', match: { conversationId: 'c1' }, isMutual: true });
    expect(result[1]).toMatchObject({
      id: 'notification:n1',
      notification: {
        kind: 'friend_accepted',
        destination: { type: 'profile', userId: 'friend-user' },
      },
    });
    expect(result[2]).toMatchObject({ id: 'gift:g1', gift: { emoji: '🎁', label: 'Gift', message: null } });
    expect(listInbox).toHaveBeenCalledWith('me', 3);
  });

  it('suppresses a mutual wave when the same peer has a first-class match', async () => {
    listInbox.mockResolvedValue([
      {
        id: 'wave:mutual',
        type: 'wave',
        createdAt: '2026-10-20T12:00:00.000Z',
        fromUser: { id: 'peer', displayName: 'Peer', avatarUrl: null },
        isMutual: true,
      },
      {
        id: 'wave:other',
        type: 'wave',
        createdAt: '2026-10-20T11:00:00.000Z',
        fromUser: { id: 'other', displayName: 'Other', avatarUrl: null },
        isMutual: false,
      },
    ] satisfies InboxItem[]);
    query
      .mockResolvedValueOnce([{
        conversation_id: 'c1', peer_id: 'peer', display_name: 'Peer', avatar_url: null,
        verification_level: null, matched_at: new Date('2026-10-20T12:00:00.000Z'),
      }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.list('me', 50);

    expect(result.map((item) => item.id)).toEqual(['match:c1', 'wave:other']);
    expect(result.some((item) => item.id === 'wave:mutual')).toBe(false);
  });

  it('uses symmetric block filtering and deleted-user filtering for projected activity', async () => {
    query.mockResolvedValue([]);
    await service.list('me', 50);

    expect(query).toHaveBeenCalledTimes(3);
    for (const call of query.mock.calls) {
      const sql = String(call[0]);
      expect(sql).toContain('user_blocks');
      expect(sql).toContain('blocker_id = $1');
      expect(sql).toContain('blocked_id = $1');
      expect(sql).toContain('u.deleted_at IS NULL');
    }
  });

  it('projects personal notifications with retention and recipient scoping', async () => {
    query.mockResolvedValue([]);
    await service.list('me', 50);

    const notificationSql = String(query.mock.calls[2]?.[0]);
    expect(notificationSql).toContain('personal_activity_notifications');
    expect(notificationSql).toContain('n.recipient_id = $1');
    expect(notificationSql).toContain("INTERVAL '90 days'");
    expect(notificationSql).toContain('n.actor_id NOT IN (SELECT uid FROM blocked)');
  });

  it('projects matches only from conversation-linked reciprocal waves and accepted conversations', async () => {
    query.mockResolvedValue([]);
    await service.list('me', 50);

    const matchSql = String(query.mock.calls[0]?.[0]);
    expect(matchSql).toContain('w.conversation_id IS NOT NULL');
    expect(matchSql).toContain("c.status = 'accepted'");
    expect(matchSql).toContain('ORDER BY w.conversation_id, w.created_at DESC');
  });

  it('does not mutate gift or notification read state while reading the unified inbox', async () => {
    query.mockResolvedValue([]);
    await service.list('me', 50);

    const sql = query.mock.calls.map((call) => String(call[0])).join('\n');
    expect(sql).not.toMatch(/UPDATE\s+gifts/i);
    expect(sql).not.toMatch(/UPDATE\s+personal_activity_notifications/i);
    expect(sql).not.toContain('seen_at =');
  });
});
