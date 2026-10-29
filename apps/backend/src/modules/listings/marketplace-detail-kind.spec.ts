import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';

import { ListingsService } from './listings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { S3Service } from '../../common/s3.service';

const DETAIL_ROW = {
  id: 'listing-1',
  seller_id: 'seller-1',
  title: 'Local electrician',
  description: 'Available this week',
  thumbnail_url: null,
  price_cents: 5000,
  currency: 'USD',
  category: 'Electrical',
  status: 'active',
  mode: 'sell',
  marketplace_kind: 'service',
  visibility: 'public',
  created_at: new Date('2026-10-29T08:00:00.000Z'),
  expires_at: null,
  bumped_at: null,
  lat: 43.21,
  lng: 27.92,
  favorited_by_me: false,
  favorite_count: 0,
  seller_display_name: 'Seller',
  seller_avatar_url: null,
} as const;

describe('ListingsService marketplace detail kind', () => {
  let service: ListingsService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: getDataSourceToken(),
          useValue: {
            query,
            createQueryRunner: jest.fn(),
          } as unknown as DataSource,
        },
        {
          provide: NotificationsService,
          useValue: { notifyListingNearby: jest.fn() },
        },
        {
          provide: S3Service,
          useValue: { uploadListingImageBuffer: jest.fn() } as unknown as S3Service,
        },
      ],
    }).compile();
    service = moduleRef.get(ListingsService);
  });

  it('projects the authoritative first-class kind for sell-side Marketplace detail', async () => {
    query
      .mockResolvedValueOnce([DETAIL_ROW])
      .mockResolvedValueOnce([]);

    const detail = await service.detail('viewer-1', 'listing-1');

    expect(detail.marketplaceKind).toBe('service');
    expect(String(query.mock.calls[0]?.[0])).toContain('l.marketplace_kind');
  });

  it('does not expose the database default as Marketplace taxonomy for wanted posts', async () => {
    query
      .mockResolvedValueOnce([{ ...DETAIL_ROW, mode: 'buy', marketplace_kind: 'for_sale' }])
      .mockResolvedValueOnce([]);

    const detail = await service.detail('viewer-1', 'listing-1');

    expect(detail.mode).toBe('buy');
    expect(detail.marketplaceKind).toBeNull();
  });
});
