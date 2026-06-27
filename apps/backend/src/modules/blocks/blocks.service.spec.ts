import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import { BlocksService } from './blocks.service';

describe('BlocksService', () => {
  let service: BlocksService;
  let query: jest.Mock;

  const A = '11111111-1111-1111-1111-111111111111';
  const B = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const mod = await Test.createTestingModule({
      providers: [BlocksService, { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource }],
    }).compile();
    service = mod.get(BlocksService);
  });

  it('rejects blocking yourself without querying', async () => {
    await expect(service.block(A, A)).rejects.toThrow();
    expect(query).not.toHaveBeenCalled();
  });

  it('block() upserts via ON CONFLICT DO NOTHING', async () => {
    await service.block(A, B);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('ON CONFLICT (blocker_id, blocked_id) DO NOTHING');
    expect(params).toEqual([A, B]);
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

  it('listBlockedBy() joins users and orders newest-first', async () => {
    await service.listBlockedBy(A);
    const [sql, params] = query.mock.calls[0]!;
    expect(sql).toContain('FROM user_blocks ub');
    expect(sql).toContain('ORDER BY ub.created_at DESC');
    expect(params).toEqual([A]);
  });
});
