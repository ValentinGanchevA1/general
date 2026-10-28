import type Redis from 'ioredis';
import * as h3 from 'h3-js';
import { DataSource } from 'typeorm';

import { RealtimeEmitterService } from '../../realtime/realtime-emitter.service';
import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';

describe('PulseActivityRealtimeService', () => {
  let query: jest.Mock;
  let set: jest.Mock;
  let del: jest.Mock;
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
    del = jest.fn().mockResolvedValue(1);
    publish = jest.fn();
    subscribe = jest.fn().mockResolvedValue(2);
    unsubscribe = jest.fn().mockResolvedValue(2);
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
      del,
      publish,
    } as unknown as Redis;
    const emitter = { to } as unknown as RealtimeEmitterService;

    service = new PulseActivityRealtimeService(
      { query } as unknown as DataSource,
      redis,
      emitter,
    );
  });

  it('publishes once and fans out a recipient-specific check-in distance without coordinates', async () => {
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

  it('publishes an explicit event join with actor and host block gates', async () => {
    const cell = h3.latLngToCell(43.2047, 27.9105, 7);
    set.mockResolvedValueOnce('OK');
    query
      .mockResolvedValueOnce([{ display_name: 'Maria' }])
      .mockResolvedValueOnce([{ id: 'viewer-2', location_h3_r7: cell }]);
    publish.mockResolvedValueOnce(1);

    await service.onModuleInit();
    await service.publishEventJoin({
      eventId: 'event-1',
      actorId: 'user-2',
      eventTitle: 'Sunset Meetup',
      eventHostId: 'host-1',
      locationH3R7: cell,
      createdAt: '2026-10-28T01:05:00.000Z',
    });

    expect(del).toHaveBeenCalledWith('pulse:activity:removed:event_join:event-1:user-2');
    expect(set).toHaveBeenCalledWith(
      'pulse:activity:published:event_join:event-1:user-2',
      '1',
      'EX',
      120,
      'NX',
    );
    const recipientSql = query.mock.calls[1]?.[0] as string;
    expect(recipientSql.match(/user_blocks/g)).toHaveLength(2);
    expect(publish).toHaveBeenCalledTimes(1);

    const payload = publish.mock.calls[0]?.[1] as string;
    expect(payload).not.toContain('locationH3R7');
    expect(messageHandler).not.toBeNull();
    messageHandler?.('pulse:activity:v1', payload);

    expect(to).toHaveBeenCalledWith('user:viewer-2');
    expect(emit).toHaveBeenCalledWith(
      'pulse:activity',
      expect.objectContaining({
        item: expect.objectContaining({
          id: 'event_join:event-1:user-2',
          actorName: 'Maria',
          type: 'event',
          distanceM: 0,
          narrative: expect.objectContaining({ kind: 'event_joined', verb: 'joined' }),
        }),
      }),
    );
  });

  it('fans out a revocation over the multi-instance removal channel', async () => {
    const cell = h3.latLngToCell(43.2047, 27.9105, 7);
    set.mockResolvedValueOnce('OK');
    query.mockResolvedValueOnce([{ id: 'viewer-2', location_h3_r7: cell }]);
    publish.mockResolvedValueOnce(1);

    await service.onModuleInit();
    await service.removeEventJoin({
      eventId: 'event-1',
      actorId: 'user-2',
      eventHostId: 'host-1',
      locationH3R7: cell,
    });

    expect(del).toHaveBeenCalledWith('pulse:activity:published:event_join:event-1:user-2');
    expect(set).toHaveBeenCalledWith(
      'pulse:activity:removed:event_join:event-1:user-2',
      '1',
      'EX',
      120,
      'NX',
    );
    expect(publish).toHaveBeenCalledWith(
      'pulse:activity:remove:v1',
      expect.any(String),
    );
    const payload = publish.mock.calls[0]?.[1] as string;
    expect(messageHandler).not.toBeNull();
    messageHandler?.('pulse:activity:remove:v1', payload);

    expect(to).toHaveBeenCalledWith('user:viewer-2');
    expect(to).toHaveBeenCalledWith('user:user-2');
    expect(emit).toHaveBeenCalledWith(
      'pulse:activity:remove',
      expect.objectContaining({ activityId: 'event_join:event-1:user-2' }),
    );
  });

  it('suppresses duplicate check-in publish attempts before querying recipients', async () => {
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

    expect(subscribe).toHaveBeenCalledWith('pulse:activity:v1', 'pulse:activity:remove:v1');
    expect(unsubscribe).toHaveBeenCalledWith('pulse:activity:v1', 'pulse:activity:remove:v1');
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
