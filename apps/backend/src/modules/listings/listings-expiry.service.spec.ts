import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { DiscoveryRealtimePublisher } from '../../realtime/discovery-realtime.publisher';
import { ListingsExpiryService } from './listings-expiry.service';

describe('ListingsExpiryService', () => {
  let service: ListingsExpiryService;
  let query: jest.Mock;
  let publishEntityChangeToSubscribers: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    publishEntityChangeToSubscribers = jest.fn().mockResolvedValue(0);

    const mod = await Test.createTestingModule({
      providers: [
        ListingsExpiryService,
        {
          provide: getDataSourceToken(),
          useValue: { query } as unknown as DataSource,
        },
        {
          provide: DiscoveryRealtimePublisher,
          useValue: { publishEntityChangeToSubscribers },
        },
      ],
    }).compile();

    service = mod.get(ListingsExpiryService);
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('atomically withdraws expired active listings before publishing discovery updates', async () => {
    query.mockResolvedValueOnce([
      { id: 'l1', lat: 42.7, lng: 23.3 },
      { id: 'l2', lat: 43.2, lng: 27.9 },
    ]);

    await service.sweep();

    expect(query).toHaveBeenCalledTimes(1);
    const sql = String(query.mock.calls[0]![0]);
    expect(sql).toContain("SET status = 'withdrawn'");
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain('expires_at <= NOW()');
    expect(sql).toContain('RETURNING id');

    expect(publishEntityChangeToSubscribers).toHaveBeenCalledTimes(2);
    expect(publishEntityChangeToSubscribers).toHaveBeenCalledWith({
      kind: 'listing',
      entityId: 'l1',
      location: { lat: 42.7, lng: 23.3 },
      change: 'update',
    });
  });

  it('does not publish when there are no newly expired listings', async () => {
    await service.sweep();

    expect(publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });

  it('keeps the sweep successful when one realtime publication fails', async () => {
    query.mockResolvedValueOnce([
      { id: 'l1', lat: 42.7, lng: 23.3 },
      { id: 'l2', lat: 43.2, lng: 27.9 },
    ]);
    publishEntityChangeToSubscribers
      .mockRejectedValueOnce(new Error('redis unavailable'))
      .mockResolvedValueOnce(0);

    await expect(service.sweep()).resolves.toBeUndefined();
    expect(publishEntityChangeToSubscribers).toHaveBeenCalledTimes(2);
  });
});
