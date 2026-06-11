import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

const ACH = [
  { id: 'lvl5', kind: 'level', threshold: 5, rewardXp: 50, title: 'L5', description: '', icon: 'star' },
  { id: 'waver', kind: 'count', metric: 'wave.reciprocated', threshold: 3, rewardXp: 0, title: 'Waver', description: '', icon: 'hand' },
];

jest.mock('@g88/shared', () => {
  const actual = jest.requireActual('@g88/shared');
  return { ...actual, ACHIEVEMENTS: ACH };
});

import { AchievementsService } from './achievements.service';
import { GamificationService } from '../gamification/gamification.service';

describe('AchievementsService', () => {
  let service: AchievementsService;
  let query: jest.Mock;
  let awardRaw: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    awardRaw = jest.fn().mockResolvedValue(undefined);
    const mod = await Test.createTestingModule({
      providers: [
        AchievementsService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: GamificationService, useValue: { awardRaw } },
      ],
    }).compile();
    service = mod.get(AchievementsService);
  });

  describe('evaluate', () => {
    it('short-circuits when everything is already unlocked', async () => {
      query.mockResolvedValueOnce([{ achievement_id: 'lvl5' }, { achievement_id: 'waver' }]);
      await service.evaluate('u1');
      expect(query).toHaveBeenCalledTimes(1); // only the "have" lookup
    });

    it('unlocks a level achievement and pays its reward once', async () => {
      query
        .mockResolvedValueOnce([]) // have: none
        .mockResolvedValueOnce([{ level: 6, longest_streak: 0 }]) // summary -> level>=5
        .mockResolvedValueOnce([]) // grouped counts for pending count-achievements
        .mockResolvedValueOnce([{ achievement_id: 'lvl5' }]) // INSERT user_achievements (won)
        .mockResolvedValueOnce([]); // (waver count = 0 < 3 -> no unlock)
      await service.evaluate('u1');
      expect(awardRaw).toHaveBeenCalledWith('u1', 50, 'achievement.unlocked', 'achievement:lvl5');
    });

    it('does not pay again when the unlock insert is a no-op (already had it)', async () => {
      query
        .mockResolvedValueOnce([]) // have: none
        .mockResolvedValueOnce([{ level: 6, longest_streak: 0 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]); // INSERT ON CONFLICT DO NOTHING -> no row
      await service.evaluate('u1');
      expect(awardRaw).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('merges catalog with unlock + progress state', async () => {
      query
        .mockResolvedValueOnce([{ achievement_id: 'lvl5', unlocked_at: new Date('2026-06-10T00:00:00Z') }])
        .mockResolvedValueOnce([{ level: 5, longest_streak: 2 }])
        .mockResolvedValueOnce([{ reason: 'wave.reciprocated', n: 1 }]);

      const list = await service.list('u1');
      const lvl5 = list.find((a) => a.id === 'lvl5')!;
      const waver = list.find((a) => a.id === 'waver')!;
      expect(lvl5).toMatchObject({ unlocked: true, progress: 5, unlockedAt: '2026-06-10T00:00:00.000Z' });
      expect(waver).toMatchObject({ unlocked: false, progress: 1, threshold: 3 });
    });
  });
});
