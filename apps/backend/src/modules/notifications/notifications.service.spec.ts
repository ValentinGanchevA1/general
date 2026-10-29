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
    query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('notification_frequency_caps')) return Promise.resolve([{ allowed: true }]);
      return Promise.resolve([]);
    });
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

  it('notifyWave checks preferences and durable cap then no-ops when the user has no devices', async () => {
    await expect(
      service.notifyWave('u1', { id: 'me', displayName: 'Me' }, 'map'),
    ).resolves.toBeUndefined();
    expect(query).toHaveBeenCalledTimes(3); // preference + durable cap + getTokens
    const capCall = query.mock.calls.find(([sql]) => String(sql).includes('notification_frequency_caps'));
    expect(capCall?.[1]).toEqual(['u1', 'waves', expect.any(Number), 12, 7200]);
  });

  it('notifyWave skips entirely when the channel is opted out', async () => {
    query.mockResolvedValueOnce([{ enabled: false }]); // preference: waves disabled
    await service.notifyWave('u1', { id: 'me', displayName: 'Me' }, 'map');
    expect(query).toHaveBeenCalledTimes(1); // preference lookup only — no cap/getTokens/send
    expect(query.mock.calls.some(([sql]) => String(sql).includes('notification_frequency_caps'))).toBe(false);
  });

  it('stops before token lookup when the durable frequency cap is exhausted', async () => {
    query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('notification_frequency_caps')) return Promise.resolve([{ allowed: false }]);
      return Promise.resolve([]);
    });
    const mod = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
      ],
    }).compile();
    const cappedService = mod.get(NotificationsService);

    await cappedService.notifyWave('u1', { id: 'me', displayName: 'Me' }, 'map');
    expect(query).toHaveBeenCalledTimes(2); // preference + cap only
    expect(query.mock.calls[1]?.[0]).toContain('ON CONFLICT (user_id, channel, window_bucket)');
    expect(query.mock.calls[1]?.[0]).toContain('LEAST(notification_frequency_caps.send_count + 1, $4 + 1)');
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
    it('processes only users with activity and keeps the daily cap durable', async () => {
      query.mockResolvedValueOnce([
        { user_id: 'a', waves: '2', gifts: '1' }, // has activity -> cap/token lookup
        { user_id: 'b', waves: '0', gifts: '0' }, // no activity -> skip
      ]);
      const res = await service.runDigest();
      expect(res.candidates).toBe(2);
      const capCall = query.mock.calls.find(([sql]) => String(sql).includes('notification_frequency_caps'));
      expect(capCall?.[1]).toEqual(['a', 'digest', expect.any(Number), 1, 172800]);
    });
  });

  it('notifyMessageFrom resolves the sender name then targets the recipient', async () => {
    query
      .mockResolvedValueOnce([{ display_name: 'Sam' }]) // sender lookup
      .mockResolvedValueOnce([]); // preference lookup
    await service.notifyMessageFrom('u1', 'sender', 'hello', 'c1');
    expect(query.mock.calls[0]![0]).toContain('SELECT display_name');
    expect(query.mock.calls.some(([sql]) => String(sql).includes('notification_frequency_caps'))).toBe(true);
  });

  describe('notifyGeofenceMatch', () => {
    it('returns immediately when the alert has no location', async () => {
      await service.notifyGeofenceMatch(null, 'author', 'general', 'body');
      expect(query).not.toHaveBeenCalled();
    });

    it('queries candidate geofences excluding the author and confirms the disk', async () => {
      query
        .mockResolvedValueOnce([{ user_id: 'r1', center_h3_r7: CELL, radius_rings: 1 }]) // geofences
        .mockResolvedValueOnce([]); // preference lookup for r1
      await service.notifyGeofenceMatch(CELL, 'author', 'general', 'Heads up');
      const [sql, params] = query.mock.calls[0]!;
      expect(sql).toContain('FROM geofences');
      expect(params[0]).toBe('author'); // author excluded
      expect(query.mock.calls.some(([capSql]) => String(capSql).includes('notification_frequency_caps'))).toBe(true);
    });
  });
});
