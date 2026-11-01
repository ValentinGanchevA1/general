import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import { RealtimeEmitterService } from '../../realtime/realtime-emitter.service';
import { GroupConversationsService } from '../chat/group-conversations.service';
import { FriendsService } from '../friends/friends.service';
import { BlocksService } from './blocks.service';

describe('BlocksService', () => {
  let service: BlocksService;
  let query: jest.Mock;
  let onBlock: jest.Mock;
  let leaveSharedGroupsForBlock: jest.Mock;
  let leaveRoomForUsers: jest.Mock;

  const A = '11111111-1111-1111-1111-111111111111';
  const B = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    onBlock = jest.fn().mockResolvedValue(undefined);
    leaveSharedGroupsForBlock = jest.fn().mockResolvedValue([]);
    leaveRoomForUsers = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        BlocksService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: FriendsService, useValue: { onBlock } },
        { provide: GroupConversationsService, useValue: { leaveSharedGroupsForBlock } },
        { provide: RealtimeEmitterService, useValue: { leaveRoomForUsers } },
      ],
    }).compile();
    service = mod.get(BlocksService);
  });

  it('rejects blocking yourself without querying', async () => {
    await expect(service.block(A, A)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    expect(onBlock).not.toHaveBeenCalled();
    expect(leaveSharedGroupsForBlock).not.toHaveBeenCalled();
    expect(leaveRoomForUsers).not.toHaveBeenCalled();
  });

  it('block() evicts the blocker from shared groups, deletes graph edges, then prunes shared DM rooms', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'conversation-1' }, { id: 'conversation-2' }]);
    leaveSharedGroupsForBlock.mockResolvedValueOnce(['group-1', 'group-2']);

    await service.block(A, B);

    const [insertSql, insertParams] = query.mock.calls[0]!;
    expect(insertSql).toContain('ON CONFLICT (blocker_id, blocked_id) DO NOTHING');
    expect(insertParams).toEqual([A, B]);
    expect(leaveSharedGroupsForBlock).toHaveBeenCalledWith(A, B);
    expect(onBlock).toHaveBeenCalledWith(A, B);
    expect(leaveSharedGroupsForBlock.mock.invocationCallOrder[0]).toBeLessThan(
      onBlock.mock.invocationCallOrder[0]!,
    );

    const [conversationSql, conversationParams] = query.mock.calls[1]!;
    expect(conversationSql).toContain("kind = 'dm'");
    expect(conversationSql).toContain('participant_ids @> ARRAY[$1, $2]::uuid[]');
    expect(conversationSql).toContain("COALESCE(status, 'accepted') = 'accepted'");
    expect(conversationParams).toEqual([A, B]);

    expect(leaveRoomForUsers).toHaveBeenNthCalledWith(1, [A], 'convo:group-1');
    expect(leaveRoomForUsers).toHaveBeenNthCalledWith(2, [A], 'convo:group-2');
    expect(leaveRoomForUsers).toHaveBeenNthCalledWith(3, [A, B], 'convo:conversation-1');
    expect(leaveRoomForUsers).toHaveBeenNthCalledWith(4, [A, B], 'convo:conversation-2');
  });

  it('does not touch realtime rooms when there are no shared groups or accepted DM', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.block(A, B);

    expect(leaveSharedGroupsForBlock).toHaveBeenCalledWith(A, B);
    expect(onBlock).toHaveBeenCalledWith(A, B);
    expect(leaveRoomForUsers).not.toHaveBeenCalled();
  });

  it('unblock() deletes the directional row without restoring group membership', async () => {
    await service.unblock(A, B);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('DELETE FROM user_blocks');
    expect(params).toEqual([A, B]);
    expect(leaveSharedGroupsForBlock).not.toHaveBeenCalled();
  });

  it('isBlocked() checks both directions and returns the EXISTS result', async () => {
    query.mockResolvedValueOnce([{ exists: true }]);
    await expect(service.isBlocked(A, B)).resolves.toBe(true);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('blocker_id = $1 AND blocked_id = $2');
    expect(sql).toContain('blocker_id = $2 AND blocked_id = $1');
    expect(params).toEqual([A, B]);
  });

  it('isBlocked() defaults to false when no row is returned', async () => {
    query.mockResolvedValueOnce([]);
    await expect(service.isBlocked(A, B)).resolves.toBe(false);
  });

  it('hasBlocked() is directional — only the blocker→blocked direction', async () => {
    query.mockResolvedValueOnce([{ exists: true }]);
    await expect(service.hasBlocked(A, B)).resolves.toBe(true);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('blocker_id = $1 AND blocked_id = $2');
    expect(sql).not.toContain('blocker_id = $2');
    expect(params).toEqual([A, B]);
  });

  it('listBlockedBy() joins users and orders newest-first', async () => {
    await service.listBlockedBy(A);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('FROM user_blocks ub');
    expect(sql).toContain('ORDER BY ub.created_at DESC');
    expect(params).toEqual([A]);
  });
});
