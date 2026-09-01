import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';

const CHALLENGE = { id: 'c1', metric: 'wave_sent', target: 2, rewardXp: 20, title: 'Wave twice' };

jest.mock('@g88/shared', () => {
  const actual = jest.requireActual('@g88/shared');
  return { ...actual, dailyChallenges: jest.fn(() => [CHALLENGE]) };
});

import { ChallengesService } from './challenges.service';
import { GamificationService } from '../gamification/gamification.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

describe('ChallengesService', () => {
  let service: ChallengesService;
  let query: jest.Mock;
  let awardRaw: jest.Mock;
  let emitChallengeCompleted: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    awardRaw = jest.fn().mockResolvedValue(undefined);
    emitChallengeCompleted = jest.fn().mockResolvedValue(undefined);
    const module = await Test.createTestingModule({
      providers: [
        ChallengesService,
        { provide: getDataSourceToken(), useValue: { query } },
        { provide: GamificationService, useValue: { awardRaw } },
        { provide: RealtimeGateway, useValue: { emitChallengeCompleted } },
      ],
    }).compile();
    service = module.get(ChallengesService);
  });

  describe('increment', () => {
    it('no-ops when the metric has no active challenges today', async () => {
      const { dailyChallenges } = jest.requireMock('@g88/shared') as {
        dailyChallenges: jest.Mock;
      };
      dailyChallenges.mockReturnValueOnce([]);
      await service.increment('u1', 'wave_sent');
      expect(query).not.toHaveBeenCalled();
      expect(awardRaw).not.toHaveBeenCalled();
    });

    it('awards XP and emits challenge:completed on first crossing', async () => {
      query
        .mockResolvedValueOnce([{ progress: 2, was_completed: false }])
        .mockResolvedValueOnce([{ id: 'c1' }]);
      await service.increment('u1', 'wave_sent');
      expect(awardRaw).toHaveBeenCalledWith(
        'u1',
        20,
        'challenge.completed',
        expect.stringContaining('challenge:c1:'),
      );
      expect(emitChallengeCompleted).toHaveBeenCalledWith('u1', {
        challengeId: 'c1',
        title: 'Wave twice',
        rewardXp: 20,
      });
    });

    it('does not reward a challenge already completed', async () => {
      query.mockResolvedValueOnce([{ progress: 5, was_completed: true }]);
      await service.increment('u1', 'wave_sent');
      expect(awardRaw).not.toHaveBeenCalled();
      expect(emitChallengeCompleted).not.toHaveBeenCalled();
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
