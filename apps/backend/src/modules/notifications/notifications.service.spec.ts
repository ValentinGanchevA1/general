import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as h3 from 'h3-js';

import { NotificationsService } from './notifications.service';

const CELL = h3.latLngToCell(51.5, -0.12, 7);

describe('NotificationsService', () => {
  let service: NotificationsService;
  let query: jest.Mock;

  beforeEach(async () => {
    delete process.env.FIREBASE_CREDENTIALS; // dev: FCM disabled -> sendMulticast no-ops
    query = jest.fn().mockResolvedValue([]);
    const mod = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
      ],
    }).compile();
    service = mod.get(NotificationsService);
  });

  it('registerToken upserts the device token', async () => {
    await service.registerToken('u1', 'tok', 'ios');
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]![0]).toContain('INSERT INTO device_tokens');
    expect(query.mock.calls[0]![1]).toEqual(['u1', 'ios', 'tok']);
  });

  it('notifyWave is a no-op (single token lookup) when the user has no devices', async () => {
    query.mockResolvedValueOnce([]); // getTokens -> none
    await expect(
      service.notifyWave('u1', { id: 'me', displayName: 'Me' }, 'map'),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(1); // only getTokens; no send path
  });

  it('notifyMessageFrom resolves the sender name then targets the recipient', async () => {
    query
      .mockResolvedValueOnce([{ display_name: 'Sam' }]) // sender lookup
      .mockResolvedValueOnce([]); // getTokens for recipient -> none
    await service.notifyMessageFrom('u1', 'sender', 'hello', 'c1');
    expect(query.mock.calls[0]![0]).toContain('SELECT display_name');
  });

  describe('notifyGeofenceMatch', () => {
    it('returns immediately when the alert has no location', async () => {
      await service.notifyGeofenceMatch(null, 'author', 'general', 'body');
      expect(query).not.toHaveBeenCalled();
    });

    it('queries candidate geofences excluding the author and confirms the disk', async () => {
      query
        .mockResolvedValueOnce([{ user_id: 'r1', center_h3_r7: CELL, radius_rings: 1 }]) // geofences
        .mockResolvedValueOnce([]); // getTokens(r1) -> none
      await service.notifyGeofenceMatch(CELL, 'author', 'general', 'Heads up');
      const [sql, params] = query.mock.calls[0]!;
      expect(sql).toContain('FROM geofences');
      expect(params[0]).toBe('author'); // author excluded
    });
  });
});
