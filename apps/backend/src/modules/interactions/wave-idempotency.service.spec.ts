import type Redis from 'ioredis';
import type { WaveResponse } from '@g88/shared';

import { InteractionsService } from './interactions.service';
import { WaveIdempotencyService } from './wave-idempotency.service';

const RESPONSE: WaveResponse = {
  id: 'wave-1',
  fromUserId: 'sender-1',
  toUserId: 'target-1',
  createdAt: '2026-10-25T04:00:00.000Z',
  conversationId: null,
};

describe('WaveIdempotencyService', () => {
  let wave: jest.Mock;
  let get: jest.Mock;
  let set: jest.Mock;
  let del: jest.Mock;
  let exists: jest.Mock;
  let service: WaveIdempotencyService;

  beforeEach(() => {
    wave = jest.fn();
    get = jest.fn();
    set = jest.fn();
    del = jest.fn();
    exists = jest.fn();

    const interactions = { wave } as unknown as InteractionsService;
    const redis = { get, set, del, exists } as unknown as Redis;
    service = new WaveIdempotencyService(interactions, redis);
  });

  it('returns the cached response without running the durable command again', async () => {
    get.mockResolvedValueOnce(JSON.stringify(RESPONSE));

    await expect(
      service.wave('sender-1', { toUserId: 'target-1', context: 'map' }),
    ).resolves.toEqual(RESPONSE);

    expect(wave).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it('executes once, caches the response and releases the lock', async () => {
    get.mockResolvedValueOnce(null);
    set.mockResolvedValueOnce('OK');
    wave.mockResolvedValueOnce(RESPONSE);
    set.mockResolvedValueOnce('OK');
    del.mockResolvedValueOnce(1);

    await expect(
      service.wave('sender-1', { toUserId: 'target-1', context: 'map' }),
    ).resolves.toEqual(RESPONSE);

    expect(wave).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenNthCalledWith(
      1,
      'wave:idempotency:sender-1:target-1:map:lock',
      '1',
      'EX',
      8,
      'NX',
    );
    expect(set).toHaveBeenNthCalledWith(
      2,
      'wave:idempotency:sender-1:target-1:map:result',
      JSON.stringify(RESPONSE),
      'EX',
      120,
    );
    expect(del).toHaveBeenCalledWith(
      'wave:idempotency:sender-1:target-1:map:lock',
    );
  });

  it('replays the first response when another identical command owns the lock', async () => {
    get
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(JSON.stringify(RESPONSE));
    set.mockResolvedValueOnce(null);
    exists.mockResolvedValueOnce(1);

    await expect(
      service.wave('sender-1', { toUserId: 'target-1', context: 'map' }),
    ).resolves.toEqual(RESPONSE);

    expect(wave).not.toHaveBeenCalled();
  });

  it('releases the lock when the durable command fails', async () => {
    get.mockResolvedValueOnce(null);
    set.mockResolvedValueOnce('OK');
    wave.mockRejectedValueOnce(new Error('db failed'));
    del.mockResolvedValueOnce(1);

    await expect(
      service.wave('sender-1', { toUserId: 'target-1', context: 'map' }),
    ).rejects.toThrow('db failed');

    expect(del).toHaveBeenCalledWith(
      'wave:idempotency:sender-1:target-1:map:lock',
    );
  });
});
