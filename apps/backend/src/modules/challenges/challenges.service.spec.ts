import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

const CHALLENGE = { id: 'c1', metric: 'wave_sent', target: 2, rewardXp: 20, title: 'Wave twice' };

jest.mock('@g88/shared', () => {
  const actual = jest.requireActual('@g88/shared');
  return { ...actual, dailyChallenges: jest.fn(() => [CHALLENGE]) };
});

import { ChallengesService } from './challenges.service';
import { GamificationService } from '../gamification/gamification.service';

describe('ChallengesService', () => {
  let service: ChallengesService;
  let query: jest.Mock;
  let awardRaw: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    awardRaw = jest.fn().mockResolvedValue(undefined);
    const mod = await Test.createTestingModule({
      providers: [
        ChallengesService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: GamificationService, useValue: { awardRaw } },
      ],
    }).compile();
    service = mod.get(ChallengesService);
  });

  describe('increment', () => {
    it('does nothing for a metric no active challenge tracks', async () => {
      await service.increment('u1', 'match_made'); // CHALLENGE tracks wave_sent
      expect(query).not.toHaveBeenCalled();
    });

    it('advances progress but does not reward below target', async () => {
      query.mockResolvedValueOnce([{ progress: 1, was_completed: false }]); // upsert
      await service.increment('u1', 'wave_sent');
      expect(awardRaw).not.toHaveBeenCalled();
    });

    it('stamps completion and rewards once when target is crossed', async () => {
      query
        .mockResolvedValueOnce([{ progress: 2, was_completed: false }]) // upsert -> at target
        .mockResolvedValueOnce([{ id: 'c1' }]); // UPDATE completed_at won the race
      await service.increment('u1', 'wave_sent');
      expect(awardRaw).toHaveBeenCalledWith('u1', 20, 'challenge.completed', expect.stringContaining('challenge:c1:'));
    });

    it('does not reward a challenge already completed', async () => {
      query.mockResolvedValueOnce([{ progress: 5, was_completed: true }]);
      await service.increment('u1', 'wave_sent');
      expect(awardRaw).not.toHaveBeenCalled();
    });
  });

  describe('getToday', () => {
    it('merges definitions with the user progress, capping at target', async () => {
      query.mockResolvedValueOnce([{ challenge_id: 'c1', progress: 5, completed_at: new Date() }]);
      const [t] = await service.getToday('u1');
      expect(t).toMatchObject({ id: 'c1', target: 2, progress: 2, completed: true });
    });

    it('reports zero progress when the user has no record', async () => {
      query.mockResolvedValueOnce([]);
      const [t] = await service.getToday('u1');
      expect(t).toMatchObject({ progress: 0, completed: false });
    });
  });
});
