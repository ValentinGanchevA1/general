import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

// Control XP amounts/caps + level/summary math so assertions are deterministic.
jest.mock('@g88/shared', () => {
  const actual = jest.requireActual('@g88/shared');
  return {
    ...actual,
    XP_AMOUNTS: { ...actual.XP_AMOUNTS, 'alert.posted': 3, 'wave.reciprocated': 10 },
    XP_DAILY_CAP: { 'alert.posted': 2 }, // only alert.posted is capped
    levelForXp: jest.fn(() => 1),
    summaryForXp: jest.fn((total: number) => ({ totalXp: total, level: 1 })),
  };
});

import { GamificationService } from './gamification.service';

describe('GamificationService', () => {
  let service: GamificationService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const mod = await Test.createTestingModule({
      providers: [
        GamificationService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
      ],
    }).compile();
    service = mod.get(GamificationService);
  });

  describe('awardRaw', () => {
    it('ignores non-positive amounts', async () => {
      await service.awardRaw('u1', 0, 'noop');
      expect(query).not.toHaveBeenCalled();
    });

    it('skips the summary bump when the insert is deduped', async () => {
      query.mockResolvedValueOnce([]); // ON CONFLICT DO NOTHING -> no row
      await service.awardRaw('u1', 10, 'gift.received', 'dk');
      expect(query).toHaveBeenCalledTimes(1); // only the insert, no summary update
    });

    it('bumps the denormalized summary after a fresh insert', async () => {
      query.mockResolvedValueOnce([{ id: 'x1' }]); // inserted
      await service.awardRaw('u1', 10, 'gift.received', 'dk');
      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[1]![0]).toContain('user_gamification');
    });
  });

  describe('award (capped reasons)', () => {
    it('stops once the daily cap is reached', async () => {
      query.mockResolvedValueOnce([{ n: 2 }]); // count == cap(2)
      await service.award('u1', 'alert.posted');
      expect(query).toHaveBeenCalledTimes(1); // count only, no insert
    });

    it('awards when under the cap', async () => {
      query
        .mockResolvedValueOnce([{ n: 0 }]) // count
        .mockResolvedValueOnce([{ id: 'x1' }]) // insert xp_events
        .mockResolvedValueOnce([]); // summary bump
      await service.award('u1', 'alert.posted', { dedupeKey: 'a:1' });
      expect(query.mock.calls[1]![0]).toContain('INSERT INTO xp_events');
    });
  });

  describe('leaderboard', () => {
    it('routes weekly scope, falls back to a separate "me" lookup, and returns resetsAt', async () => {
      query
        .mockResolvedValueOnce([{ rank: 1, userId: 'other', isMe: false }]) // weeklyTop
        .mockResolvedValueOnce([{ rank: 9, userId: 'u1', isMe: true }]) // weeklyMe
        .mockResolvedValueOnce([{ resets_at: new Date('2026-06-15T00:00:00Z') }]); // weekResetsAt
      const res = await service.leaderboard('u1', 'weekly');
      expect(res.scope).toBe('weekly');
      expect(res.me).toMatchObject({ userId: 'u1', rank: 9 });
      expect(res.resetsAt).toBe('2026-06-15T00:00:00.000Z');
    });

    it('uses the "me" row already present in the top page and omits resetsAt for all-time', async () => {
      query.mockResolvedValueOnce([{ rank: 2, userId: 'u1', isMe: true }]); // allTimeTop
      const res = await service.leaderboard('u1', 'all_time');
      expect(res.me).toMatchObject({ userId: 'u1' });
      expect(res.resetsAt).toBeUndefined();
      expect(query).toHaveBeenCalledTimes(1); // no separate me-lookup, no week-boundary query
    });
  });

  describe('getSummary', () => {
    it('defaults to zeros when the user has no row', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.getSummary('u1')).resolves.toEqual({ totalXp: 0, level: 1 });
    });
  });
});
