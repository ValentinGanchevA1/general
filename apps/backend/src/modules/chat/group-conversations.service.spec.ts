import { BadRequestException, ConflictException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';

import { GroupConversationsService } from './group-conversations.service';

const CREATOR = '11111111-1111-4111-8111-111111111111';
const MEMBER_A = '22222222-2222-4222-8222-222222222222';
const MEMBER_B = '33333333-3333-4333-8333-333333333333';
const GROUP_ID = '44444444-4444-4444-8444-444444444444';
const REQUEST_ID = '55555555-5555-4555-8555-555555555555';

const SUMMARY_ROW = {
  id: GROUP_ID,
  title: 'Varna builders',
  created_by: CREATOR,
  last_message_at: null,
  last_body: null,
  last_sender_id: null,
  unread_count: 0,
  members: [
    { id: CREATOR, displayName: 'Owner', avatarUrl: null, role: 'owner' as const },
    { id: MEMBER_A, displayName: 'A', avatarUrl: null, role: 'member' as const },
    { id: MEMBER_B, displayName: 'B', avatarUrl: null, role: 'member' as const },
  ],
};

function request() {
  return {
    clientRequestId: REQUEST_ID,
    title: '  Varna builders  ',
    memberIds: [MEMBER_A, MEMBER_B],
  };
}

describe('GroupConversationsService', () => {
  const dbQuery = jest.fn();
  const transaction = jest.fn();
  const db = { query: dbQuery, transaction } as unknown as DataSource;
  const service = new GroupConversationsService(db);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a group with empty legacy participants and normalized owner/member rows', async () => {
    const txQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: MEMBER_A, is_friend: true, blocked: false },
        { id: MEMBER_B, is_friend: true, blocked: false },
      ])
      .mockResolvedValueOnce([{ blocked: false }])
      .mockResolvedValueOnce([{ id: GROUP_ID }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([SUMMARY_ROW]);
    transaction.mockImplementation(async (work: (tx: EntityManager) => Promise<unknown>) =>
      work({ query: txQuery } as unknown as EntityManager));

    const result = await service.create(CREATOR, request());

    expect(result.reused).toBe(false);
    expect(result.conversation.kind).toBe('group');
    expect(result.conversation.title).toBe('Varna builders');

    const createSql = String(txQuery.mock.calls[3]?.[0]);
    expect(createSql).toContain("ARRAY[]::uuid[]");
    expect(createSql).toContain("'group'");
    expect(createSql).toContain('creation_key');

    const memberSql = String(txQuery.mock.calls[4]?.[0]);
    expect(memberSql).toContain("THEN 'owner' ELSE 'member'");
    expect(txQuery.mock.calls[4]?.[1]).toEqual([
      GROUP_ID,
      CREATOR,
      [CREATOR, MEMBER_A, MEMBER_B],
    ]);
  });

  it('rejects group creation when invited members have blocked each other', async () => {
    const txQuery = jest.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: MEMBER_A, is_friend: true, blocked: false },
        { id: MEMBER_B, is_friend: true, blocked: false },
      ])
      .mockResolvedValueOnce([{ blocked: true }]);
    transaction.mockImplementation(async (work: (tx: EntityManager) => Promise<unknown>) =>
      work({ query: txQuery } as unknown as EntityManager));

    await expect(service.create(CREATOR, request())).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'chat.group_invite_forbidden' }),
    });

    const blockSql = String(txQuery.mock.calls[2]?.[0]);
    expect(blockSql).toContain('b.blocker_id = ANY($1::uuid[])');
    expect(blockSql).toContain('b.blocked_id = ANY($1::uuid[])');
    expect(txQuery.mock.calls[2]?.[1]).toEqual([[CREATOR, MEMBER_A, MEMBER_B]]);
    expect(
      txQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO conversations')),
    ).toBe(false);
  });

  it('reuses an identical client request without inserting another group', async () => {
    const txQuery = jest.fn()
      .mockResolvedValueOnce([{ id: GROUP_ID }])
      .mockResolvedValueOnce([{
        title: 'Varna builders',
        member_ids: [CREATOR, MEMBER_A, MEMBER_B].sort(),
      }])
      .mockResolvedValueOnce([SUMMARY_ROW]);
    transaction.mockImplementation(async (work: (tx: EntityManager) => Promise<unknown>) =>
      work({ query: txQuery } as unknown as EntityManager));

    const result = await service.create(CREATOR, request());

    expect(result.reused).toBe(true);
    expect(result.conversation.id).toBe(GROUP_ID);
    expect(txQuery).toHaveBeenCalledTimes(3);
    expect(txQuery.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO conversations'))).toBe(false);
  });

  it('rejects reuse of a request id with different group details', async () => {
    const txQuery = jest.fn()
      .mockResolvedValueOnce([{ id: GROUP_ID }])
      .mockResolvedValueOnce([{
        title: 'Different title',
        member_ids: [CREATOR, MEMBER_A, MEMBER_B].sort(),
      }]);
    transaction.mockImplementation(async (work: (tx: EntityManager) => Promise<unknown>) =>
      work({ query: txQuery } as unknown as EntityManager));

    await expect(service.create(CREATOR, request())).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects duplicate invitees before opening a transaction', async () => {
    await expect(service.create(CREATOR, {
      ...request(),
      memberIds: [MEMBER_A, MEMBER_A],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('lists only active group memberships with bilateral block isolation', async () => {
    dbQuery.mockResolvedValueOnce([SUMMARY_ROW]);

    const result = await service.list(CREATOR);

    expect(result).toEqual([{
      id: GROUP_ID,
      kind: 'group',
      title: 'Varna builders',
      createdBy: CREATOR,
      members: SUMMARY_ROW.members,
      lastMessageAt: null,
      lastMessage: null,
      unreadCount: 0,
    }]);

    const sql = String(dbQuery.mock.calls[0]?.[0]);
    expect(sql).toContain("c.kind = 'group'");
    expect(sql).toContain('viewer.left_at IS NULL');
    expect(sql).toContain('member.left_at IS NULL');
    expect(sql).toContain('blocked_member.left_at IS NULL');
    expect(sql).toContain('user_blocks');
    expect(sql).not.toContain('c.participant_ids');
  });
});
