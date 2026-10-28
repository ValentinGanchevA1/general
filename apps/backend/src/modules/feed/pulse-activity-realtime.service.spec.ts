import type Redis from 'ioredis';
import * as h3 from 'h3-js';
import { DataSource } from 'typeorm';

import { RealtimeEmitterService } from '../../realtime/realtime-emitter.service';
import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';

describe('PulseActivityRealtimeService', () => {
  let query: jest.Mock;
  let set: jest.Mock;
  let publish: jest.Mock;
  let subscribe: jest.Mock;
  let unsubscribe: jest.Mock;
  let disconnect: jest.Mock;
  let emit: jest.Mock;
  let to: jest.Mock;
  let messageHandler: ((channel: string, payload: string) => void) | null;
  let service: PulseActivityRealtimeService;

  beforeEach(() => {
    messageHandler = null;
    query = jest.fn();
    set = jest.fn();
    publish = jest.fn();
    subscribe = jest.fn().mockResolvedValue(1);
    unsubscribe = jest.fn().mockResolvedValue(1);
    disconnect = jest.fn();
    emit = jest.fn();
    to = jest.fn(() => ({ emit }));

    const subscriber = {
      on: jest.fn((event: string, handler: (channel: string, payload: string) => void) => {
        if (event === 'message') messageHandler = handler;
      }),
      subscribe,
      unsubscribe,
      disconnect,
    };
    const redis = {
      duplicate: jest.fn(() => subscriber),
      set,
      publish,
    } as unknown as Redis;
    const emitter = { to } as unknown as RealtimeEmitterService;

    service = new PulseActivityRealtimeService(
      { query } as unknown as DataSource,
      redis,
      emitter,
    );
  });

  it('publishes once and fans out a recipient-specific distance without coordinates', async () => {
    const cell = h3.latLngToCell(43.2047, 27.9105, 7);
    set.mockResolvedValueOnce('OK');
    query
      .mockResolvedValueOnce([{ display_name: 'Valentin' }])
      .mockResolvedValueOnce([{ id: 'viewer-1', location_h3_r7: cell }]);
    publish.mockResolvedValueOnce(1);

    await service.onModuleInit();
    await service.publishCheckIn({
      checkInId: 'check-in-1',
      actorId: 'user-1',
      placeLabel: 'Sea Garden',
      audience: 'nearby',
      locationH3R7: cell,
      createdAt: '2026-10-28T01:00:00.000Z',
    });

    expect(set).toHaveBeenCalledWith(
      'pulse:activity:published:check-in-1',
      '1',
      'EX',
      120,
      'NX',
    );
    const recipientSql = query.mock.calls[1]?.[0] as string;
    expect(recipientSql).toContain('user_blocks');
    expect(recipientSql).toContain('friendships');
    expect(recipientSql).toContain("$2 = 'nearby'");
    expect(publish).toHaveBeenCalledTimes(1);
    const payload = publish.mock.calls[0]?.[1] as string;
    expect(payload).not.toContain('43.2047');
    expect(payload).not.toContain('27.9105');
    expect(payload).not.toContain('locationH3R7');

    expect(messageHandler).not.toBeNull();
    messageHandler?.('pulse:activity:v1', payload);

    expect(to).toHaveBeenCalledWith('user:viewer-1');
    expect(emit).toHaveBeenCalledWith(
      'pulse:activity',
      expect.objectContaining({
        item: expect.objectContaining({
          id: 'place:check-in-1',
          actorName: 'Valentin',
          distanceM: 0,
        }),
      }),
    );
  });

  it('suppresses duplicate publish attempts before querying recipients', async () => {
    set.mockResolvedValueOnce(null);

    await service.publishCheckIn({
      checkInId: 'check-in-1',
      actorId: 'user-1',
      placeLabel: 'Sea Garden',
      audience: 'friends',
      locationH3R7: h3.latLngToCell(43.2047, 27.9105, 7),
      createdAt: '2026-10-28T01:00:00.000Z',
    });

    expect(query).not.toHaveBeenCalled();
    expect(publish).not.toHaveBeenCalled();
  });

  it('unsubscribes the process-local Redis consumer on shutdown', async () => {
    await service.onModuleInit();
    await service.onModuleDestroy();

    expect(subscribe).toHaveBeenCalledWith('pulse:activity:v1');
    expect(unsubscribe).toHaveBeenCalledWith('pulse:activity:v1');
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
