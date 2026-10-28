import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import { RealtimeEmitterService } from '../../realtime/realtime-emitter.service';
import { FriendsService } from '../friends/friends.service';
import { BlocksService } from './blocks.service';

describe('BlocksService', () => {
  let service: BlocksService;
  let query: jest.Mock;
  let onBlock: jest.Mock;
  let leaveRoomForUsers: jest.Mock;

  const A = '11111111-1111-1111-1111-111111111111';
  const B = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    onBlock = jest.fn().mockResolvedValue(undefined);
    leaveRoomForUsers = jest.fn();
    const mod = await Test.createTestingModule({
      providers: [
        BlocksService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: FriendsService, useValue: { onBlock } },
        { provide: RealtimeEmitterService, useValue: { leaveRoomForUsers } },
      ],
    }).compile();
    service = mod.get(BlocksService);
  });

  it('rejects blocking yourself without querying', async () => {
    await expect(service.block(A, A)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
    expect(onBlock).not.toHaveBeenCalled();
    expect(leaveRoomForUsers).not.toHaveBeenCalled();
  });

  it('block() upserts, cascades graph delete, then prunes both users from shared conversation rooms', async () => {
    query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'conversation-1' }, { id: 'conversation-2' }]);

    await service.block(A, B);

    const [insertSql, insertParams] = query.mock.calls[0]!;
    expect(insertSql).toContain('ON CONFLICT (blocker_id, blocked_id) DO NOTHING');
    expect(insertParams).toEqual([A, B]);
    expect(onBlock).toHaveBeenCalledWith(A, B);

    const [conversationSql, conversationParams] = query.mock.calls[1]!;
    expect(conversationSql).toContain('participant_ids @> ARRAY[$1, $2]::uuid[]');
    expect(conversationSql).toContain("COALESCE(status, 'accepted') = 'accepted'");
    expect(conversationParams).toEqual([A, B]);
    expect(leaveRoomForUsers).toHaveBeenNthCalledWith(1, [A, B], 'convo:conversation-1');
    expect(leaveRoomForUsers).toHaveBeenNthCalledWith(2, [A, B], 'convo:conversation-2');
  });

  it('does not touch realtime rooms when the pair has no accepted conversation', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.block(A, B);

    expect(onBlock).toHaveBeenCalledWith(A, B);
    expect(leaveRoomForUsers).not.toHaveBeenCalled();
  });

  it('unblock() deletes the directional row', async () => {
    await service.unblock(A, B);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('DELETE FROM user_blocks');
    expect(params).toEqual([A, B]);
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
    expect(sql).not.toContain('blocker_id = $2'); // not symmetric
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
