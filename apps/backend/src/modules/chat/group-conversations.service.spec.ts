import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';

import { GroupConversationsService } from './group-conversations.service';

const CREATOR = '00000000-0000-4000-8000-000000000001';
const MEMBER_A = '00000000-0000-4000-8000-000000000002';
const MEMBER_B = '00000000-0000-4000-8000-000000000003';
const GROUP_ID = '00000000-0000-4000-8000-000000000010';

describe('GroupConversationsService', () => {
  const txQuery = jest.fn();
  const query = jest.fn();
  const transaction = jest.fn(async (callback: (tx: { query: typeof txQuery }) => unknown) =>
    callback({ query: txQuery }),
  );
  const db = { query, transaction } as unknown as DataSource;
  const service = new GroupConversationsService(db);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a normalized group with an empty legacy participant array', async () => {
    txQuery
      .mockResolvedValueOnce([{ id: CREATOR }, { id: MEMBER_A }, { id: MEMBER_B }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([
        {
          id: GROUP_ID,
          title: 'Varna crew',
          last_message_at: null,
          created_at: '2026-10-29T20:00:00.000Z',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.create(CREATOR, '  Varna crew  ', [MEMBER_A, MEMBER_B]);

    expect(result).toEqual({
      id: GROUP_ID,
      title: 'Varna crew',
      role: 'owner',
      muted: false,
      memberCount: 3,
      lastMessageAt: null,
      createdAt: '2026-10-29T20:00:00.000Z',
    });

    const [createSql, createParams] = txQuery.mock.calls[2]!;
    expect(createSql).toContain("ARRAY[]::uuid[], 'group'");
    expect(createSql).toContain("'accepted', NULL");
    expect(createParams).toEqual(['Varna crew', CREATOR]);

    const [ownerSql, ownerParams] = txQuery.mock.calls[3]!;
    expect(ownerSql).toContain("'owner'");
    expect(ownerParams).toEqual([GROUP_ID, CREATOR]);

    const [membersSql, membersParams] = txQuery.mock.calls[4]!;
    expect(membersSql).toContain("'member'");
    expect(membersParams).toEqual([GROUP_ID, [MEMBER_A, MEMBER_B]]);
  });

  it('rejects creator duplication before opening a transaction', async () => {
    await expect(service.create(CREATOR, 'Group', [CREATOR, MEMBER_A])).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects unavailable members', async () => {
    txQuery.mockResolvedValueOnce([{ id: CREATOR }, { id: MEMBER_A }]);

    await expect(service.create(CREATOR, 'Group', [MEMBER_A, MEMBER_B])).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'chat.group_member_invalid' }),
    });
  });

  it('fails closed when any selected pair has a block relationship', async () => {
    txQuery
      .mockResolvedValueOnce([{ id: CREATOR }, { id: MEMBER_A }, { id: MEMBER_B }])
      .mockResolvedValueOnce([{ exists: true }]);

    await expect(service.create(CREATOR, 'Group', [MEMBER_A, MEMBER_B])).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(txQuery).toHaveBeenCalledTimes(2);
  });

  it('lists only privacy-minimal group metadata for active membership', async () => {
    query.mockResolvedValueOnce([
      {
        id: GROUP_ID,
        title: 'Varna crew',
        role: 'member',
        muted: true,
        member_count: 4,
        last_message_at: new Date('2026-10-29T20:30:00.000Z'),
        created_at: new Date('2026-10-29T19:00:00.000Z'),
      },
    ]);

    await expect(service.listForUser(MEMBER_A)).resolves.toEqual([
      {
        id: GROUP_ID,
        title: 'Varna crew',
        role: 'member',
        muted: true,
        memberCount: 4,
        lastMessageAt: '2026-10-29T20:30:00.000Z',
        createdAt: '2026-10-29T19:00:00.000Z',
      },
    ]);

    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain("c.kind = 'group'");
    expect(sql).toContain('viewer.left_at IS NULL');
    expect(sql).toContain('member.left_at IS NULL');
    expect(sql).not.toContain('display_name');
    expect(params).toEqual([MEMBER_A]);
  });
});
