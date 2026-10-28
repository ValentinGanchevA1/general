import { DataSource } from 'typeorm';

import { NotificationsService } from '../notifications/notifications.service';
import { MarketplaceService } from './marketplace.service';

describe('MarketplaceService', () => {
  const now = new Date('2026-10-28T20:00:00.000Z');

  function makeService() {
    const query = jest.fn();
    const notifyListingNearby = jest.fn().mockResolvedValue(undefined);
    const db = { query } as unknown as DataSource;
    const notifications = { notifyListingNearby } as unknown as NotificationsService;
    return { service: new MarketplaceService(db, notifications), query, notifyListingNearby };
  }

  it('filters browse by first-class marketplace kind and query', async () => {
    const { service, query } = makeService();
    query.mockResolvedValueOnce([
      {
        id: 'l1',
        seller_id: 'u2',
        title: 'House Cleaning',
        thumbnail_url: null,
        price_cents: 6500,
        currency: 'EUR',
        category: 'Home Services',
        status: 'active',
        mode: 'sell',
        marketplace_kind: 'service',
        lat: 43.2,
        lng: 27.9,
        created_at: now,
        expires_at: now,
        bumped_at: null,
        favorited_by_me: false,
      },
    ]);

    const result = await service.browse('u1', {
      location: { lat: 43.2, lng: 27.9 },
      marketplaceKind: 'service',
      query: 'clean',
    });

    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('l.marketplace_kind = $5'),
      ['u1', 27.9, 43.2, 5000, 'service', 50, 'clean'],
    );
    expect(result[0]?.marketplaceKind).toBe('service');
  });

  it('writes the explicit marketplace kind on create', async () => {
    const { service, query, notifyListingNearby } = makeService();
    query.mockResolvedValueOnce([
      {
        id: 'l2',
        seller_id: 'u1',
        title: 'Frontend contract',
        thumbnail_url: null,
        price_cents: 120000,
        currency: 'EUR',
        category: 'Tech',
        status: 'active',
        mode: 'sell',
        marketplace_kind: 'job',
        lat: 43.2,
        lng: 27.9,
        created_at: now,
        expires_at: now,
        bumped_at: null,
        favorited_by_me: false,
      },
    ]);

    const created = await service.create('u1', {
      title: 'Frontend contract',
      priceCents: 120000,
      currency: 'EUR',
      category: 'Tech',
      location: { lat: 43.2, lng: 27.9 },
      marketplaceKind: 'job',
    });

    const call = query.mock.calls[0];
    expect(call?.[0]).toEqual(expect.stringContaining('marketplace_kind'));
    expect(call?.[1]?.[8]).toBe('job');
    expect(created.marketplaceKind).toBe('job');
    expect(notifyListingNearby).toHaveBeenCalledWith(expect.any(String), 'u1', 'Frontend contract', 'l2');
  });
});
