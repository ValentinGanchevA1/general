import { NotFoundException } from '@nestjs/common';

import type { ListingOffer } from '@g88/shared';

import { DiscoveryRealtimePublisher } from '../../realtime/discovery-realtime.publisher';
import { ListingsController } from './listings.controller';
import { ListingsService } from './listings.service';

describe('ListingsController', () => {
  const acceptedOffer: ListingOffer = {
    id: 'offer-1',
    listingId: 'listing-1',
    buyerId: 'buyer-1',
    buyerDisplayName: 'Buyer',
    buyerAvatarUrl: null,
    offerCents: 5000,
    message: null,
    status: 'accepted',
    lastActor: 'seller',
    createdAt: '2026-10-26T00:00:00.000Z',
  };

  it('returns an accepted private offer when buyer-scoped detail remains hidden', async () => {
    const listings = {
      respondToOffer: jest.fn().mockResolvedValue(acceptedOffer),
      detail: jest.fn().mockRejectedValue(
        new NotFoundException({ code: 'listing.not_found', message: 'Listing not found.' }),
      ),
    };
    const discovery = {
      publishEntityChangeToSubscribers: jest.fn(),
    };
    const controller = new ListingsController(
      listings as unknown as ListingsService,
      discovery as unknown as DiscoveryRealtimePublisher,
    );

    await expect(
      controller.respondToOffer('buyer-1', 'offer-1', { status: 'accepted' }),
    ).resolves.toEqual(acceptedOffer);
    expect(discovery.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });

  it('still publishes the sold transition for an accessible public listing', async () => {
    const listings = {
      respondToOffer: jest.fn().mockResolvedValue(acceptedOffer),
      detail: jest.fn().mockResolvedValue({
        id: 'listing-1',
        visibility: 'public',
        location: { lat: 43.2, lng: 27.9 },
      }),
    };
    const discovery = {
      publishEntityChangeToSubscribers: jest.fn().mockResolvedValue(undefined),
    };
    const controller = new ListingsController(
      listings as unknown as ListingsService,
      discovery as unknown as DiscoveryRealtimePublisher,
    );

    await controller.respondToOffer('seller-1', 'offer-1', { status: 'accepted' });

    expect(discovery.publishEntityChangeToSubscribers).toHaveBeenCalledWith({
      kind: 'listing',
      entityId: 'listing-1',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });
  });
});
