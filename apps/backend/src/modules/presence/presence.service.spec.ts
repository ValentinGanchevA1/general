import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { fuzzLocation } from '@g88/shared';

import { PresenceService } from './presence.service';
import { REDIS_CLIENT } from '../../config/redis.provider';

describe('PresenceService', () => {
  let service: PresenceService;
  let query: jest.Mock;
  let redis: {
    get: jest.Mock;
    mget: jest.Mock;
    pipeline: jest.Mock;
    zrevrange: jest.Mock;
    zremrangebyscore: jest.Mock;
  };
  let pipe: Record<string, jest.Mock>;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    pipe = {
      set: jest.fn().mockReturnThis(),
      zadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      zrem: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      mget: jest.fn().mockResolvedValue([]),
      pipeline: jest.fn(() => pipe),
      zrevrange: jest.fn().mockResolvedValue([]),
      zremrangebyscore: jest.fn().mockResolvedValue(0),
    };
    const mod = await Test.createTestingModule({
      providers: [
        PresenceService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    service = mod.get(PresenceService);
  });

  describe('heartbeat', () => {
    const loc = { lat: 51.5, lng: -0.12 };

    it('marks online, joins the cell set and persists location on the first beat', async () => {
      redis.get.mockResolvedValue(null); // no previous cell
      const res = await service.heartbeat('u1', loc);

      const expected = fuzzLocation(loc, 10);
      expect(res.prevCellId).toBeNull();
      expect(res.lat).toBeCloseTo(expected.lat, 5);
      expect(res.lng).toBeCloseTo(expected.lng, 5);
      expect(pipe.set).toHaveBeenCalledWith('presence:user:u1', '1', 'EX', 120);
      expect(pipe.exec).toHaveBeenCalled();
      expect(query).toHaveBeenCalledTimes(1); // persistLocation ran (cell changed from null)
    });

    it('removes the user from the previous cell on a boundary crossing', async () => {
      redis.get.mockResolvedValue('old-cell'); // different from the new cell
      const res = await service.heartbeat('u1', loc);
      expect(res.prevCellId).toBe('old-cell');
      expect(pipe.zrem).toHaveBeenCalledWith('presence:cell:old-cell', 'u1');
    });
  });

  describe('whichAreOnline', () => {
    it('returns the empty set for no candidates (no Redis call)', async () => {
      await expect(service.whichAreOnline([])).resolves.toEqual(new Set());
      expect(redis.mget).not.toHaveBeenCalled();
    });

    it('keeps only the ids whose presence key is "1"', async () => {
      redis.mget.mockResolvedValue(['1', null, '1']);
      const online = await service.whichAreOnline(['a', 'b', 'c']);
      expect(online).toEqual(new Set(['a', 'c']));
    });
  });

  describe('markOffline', () => {
    it('deletes presence keys and drops the user from their cell set', async () => {
      redis.get.mockResolvedValue('cell-x');
      await service.markOffline('u1');
      expect(pipe.del).toHaveBeenCalledWith('presence:user:u1');
      expect(pipe.zrem).toHaveBeenCalledWith('presence:cell:cell-x', 'u1');
    });
  });

  describe('usersInCell', () => {
    it('returns the cell ZSET newest-first', async () => {
      redis.zrevrange.mockResolvedValue(['a', 'b']);
      await expect(service.usersInCell('cell-x', 10)).resolves.toEqual(['a', 'b']);
      expect(redis.zrevrange).toHaveBeenCalledWith('presence:cell:cell-x', 0, 9);
    });
  });
});
