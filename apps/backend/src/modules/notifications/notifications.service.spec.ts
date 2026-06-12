import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import * as h3 from 'h3-js';

import { NotificationsService } from './notifications.service';
import { REDIS_CLIENT } from '../../config/redis.provider';

const CELL = h3.latLngToCell(51.5, -0.12, 7);

describe('NotificationsService', () => {
  let service: NotificationsService;
  let query: jest.Mock;
  let redis: { incr: jest.Mock; expire: jest.Mock };

  beforeEach(async () => {
    delete process.env.FIREBASE_CREDENTIALS; // dev: FCM disabled -> sendMulticast no-ops
    query = jest.fn().mockResolvedValue([]);
    redis = { incr: jest.fn().mockResolvedValue(1), expire: jest.fn().mockResolvedValue(1) };
    const mod = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        { provide: REDIS_CLIENT, useValue: redis },
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

  it('notifyWave checks the channel then no-ops when the user has no devices', async () => {
    // allowed(): preference lookup (none) -> Redis cap (ok); then getTokens (none).
    await expect(
      service.notifyWave('u1', { id: 'me', displayName: 'Me' }, 'map'),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2); // pref lookup + getTokens
    expect(redis.incr).toHaveBeenCalled();
  });

  it('notifyWave skips entirely when the channel is opted out', async () => {
    query.mockResolvedValueOnce([{ enabled: false }]); // preference: waves disabled
    await service.notifyWave('u1', { id: 'me', displayName: 'Me' }, 'map');
    expect(query).toHaveBeenCalledTimes(1); // pref lookup only — no getTokens / send
    expect(redis.incr).not.toHaveBeenCalled();
  });

  describe('preferences', () => {
    it('getPreferences defaults every channel to on, applying opt-out rows', async () => {
      query.mockResolvedValueOnce([{ channel: 'gifts', enabled: false }]);
      const prefs = await service.getPreferences('u1');
      expect(prefs.waves).toBe(true);
      expect(prefs.gifts).toBe(false);
      expect(prefs.digest).toBe(true);
    });

    it('setPreferences upserts known channels and ignores junk', async () => {
      query.mockResolvedValue([]);
      await service.setPreferences('u1', { waves: false, bogus: true } as never);
      const upserts = query.mock.calls.filter((c) => String(c[0]).includes('INSERT INTO notification_preferences'));
      expect(upserts).toHaveLength(1); // only the valid 'waves' channel
      expect(upserts[0]![1]).toEqual(['u1', 'waves', false]);
    });
  });

  describe('runDigest', () => {
    it('sends only to users with activity and counts them', async () => {
      query.mockResolvedValueOnce([
        { user_id: 'a', waves: '2', gifts: '1' }, // has activity -> send
        { user_id: 'b', waves: '0', gifts: '0' }, // no activity -> skip
      ]);
      // user 'a': allowed() pref lookup (none) then getTokens (none) -> no FCM, still counts as attempted-but-no-token
      query.mockResolvedValue([]);
      const res = await service.runDigest();
      expect(res.candidates).toBe(2);
    });
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
