import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { AlertsService } from './alerts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';
import { ChallengesService } from '../challenges/challenges.service';
import { AchievementsService } from '../achievements/achievements.service';

describe('AlertsService', () => {
  let service: AlertsService;
  let query: jest.Mock;
  let notifyGeofenceMatch: jest.Mock;
  let award: jest.Mock;
  let increment: jest.Mock;
  let evaluate: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    notifyGeofenceMatch = jest.fn().mockResolvedValue(undefined);
    award = jest.fn().mockResolvedValue(undefined);
    increment = jest.fn().mockResolvedValue(undefined);
    evaluate = jest.fn().mockResolvedValue(undefined);

    const mod = await Test.createTestingModule({
      providers: [
        AlertsService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: NotificationsService, useValue: { notifyGeofenceMatch } },
        { provide: GamificationService, useValue: { award } },
        { provide: ChallengesService, useValue: { increment } },
        { provide: AchievementsService, useValue: { evaluate } },
      ],
    }).compile();
    service = mod.get(AlertsService);
  });

  const dto = { category: 'general', body: 'Road closed', tag: null } as never;

  it('throws NotFound when the author row is missing', async () => {
    query.mockResolvedValueOnce([]); // INSERT ... SELECT FROM users -> no row
    await expect(service.create('u1', dto)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('persists the alert and fans out reward + geofence + quest side-effects', async () => {
    query.mockResolvedValueOnce([
      { id: 'a1', created_at: new Date('2026-06-10T00:00:00Z'), location_h3_r7: 'cell-7' },
    ]);

    const res = await service.create('u1', dto);

    expect(res).toMatchObject({ id: 'a1', category: 'general', body: 'Road closed' });
    expect(res.createdAt).toBe('2026-06-10T00:00:00.000Z');
    expect(notifyGeofenceMatch).toHaveBeenCalledWith('cell-7', 'u1', 'general', 'Road closed');
    expect(award).toHaveBeenCalledWith('u1', 'alert.posted', { dedupeKey: 'alert:a1' });
    expect(increment).toHaveBeenCalledWith('u1', 'alert_posted');
    expect(evaluate).toHaveBeenCalledWith('u1');
  });
});
