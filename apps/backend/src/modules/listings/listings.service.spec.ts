import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { ListingsService } from './listings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { S3Service } from '../../common/s3.service';
import { BadRequestException } from '@nestjs/common';

/** queryRunner whose query() drains a pre-seeded FIFO result queue. */
function makeQueryRunner(results: unknown[]) {
  const query = jest.fn((..._args: unknown[]) => Promise.resolve(results.shift() ?? []));
  const runner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query,
  };
  return { runner, query };
}

describe('ListingsService', () => {
  let service: ListingsService;
  let query: jest.Mock;
  let createQueryRunner: jest.Mock;
  let uploadListingImageBuffer: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    createQueryRunner = jest.fn();
    uploadListingImageBuffer = jest.fn().mockResolvedValue('https://cdn.example/listings/s1/x.jpg');
    const mod = await Test.createTestingModule({
      providers: [
        ListingsService,
        {
          provide: getDataSourceToken(),
          useValue: { query, createQueryRunner } as unknown as DataSource,
        },
        { provide: NotificationsService, useValue: { notifyListingNearby: jest.fn().mockResolvedValue(undefined) } },
        { provide: S3Service, useValue: { uploadListingImageBuffer } as unknown as S3Service },
      ],
    }).compile();
    service = mod.get(ListingsService);
  });

  const loc = { lat: 43.2, lng: 27.9 };

  describe('create', () => {
    it('inserts and returns a summary (favoritedByMe false)', async () => {
      query.mockResolvedValueOnce([
        {
          id: 'l1', seller_id: 's1', title: 'Bike', thumbnail_url: null,
          price_cents: 5000, currency: 'USD', category: 'sports', status: 'active',
          created_at: new Date('2026-06-12T00:00:00Z'), lat: 43.2, lng: 27.9,
        },
      ]);
      const res = await service.create('s1', {
        title: 'Bike', priceCents: 5000, category: 'sports', location: loc,
      } as never);
      expect(res).toMatchObject({ id: 'l1', sellerId: 's1', priceCents: 5000, favoritedByMe: false });
      expect(res.location).toEqual(loc);
    });
  });

  describe('uploadImage', () => {
    const oneByteJpegB64 = Buffer.from([0xff]).toString('base64');

    it('decodes, uploads, and returns the public URL', async () => {
      const res = await service.uploadImage('s1', oneByteJpegB64, 'image/jpeg');
      expect(res).toEqual({ url: 'https://cdn.example/listings/s1/x.jpg' });
      expect(uploadListingImageBuffer).toHaveBeenCalledWith('s1', expect.any(Buffer), 'image/jpeg');
    });

    it('rejects empty/invalid base64 without hitting S3', async () => {
      await expect(service.uploadImage('s1', '', 'image/jpeg')).rejects.toBeInstanceOf(BadRequestException);
      expect(uploadListingImageBuffer).not.toHaveBeenCalled();
    });

    it('rejects an image over the 10 MB cap', async () => {
      const big = Buffer.alloc(10 * 1024 * 1024 + 1).toString('base64');
      await expect(service.uploadImage('s1', big, 'image/png')).rejects.toBeInstanceOf(BadRequestException);
      expect(uploadListingImageBuffer).not.toHaveBeenCalled();
    });
  });

  describe('makeOffer', () => {
    it('forbids the seller offering on their own listing', async () => {
      query.mockResolvedValueOnce([{ seller_id: 'me', status: 'active' }]);
      await expect(
        service.makeOffer('me', 'l1', { offerCents: 100 } as never),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects offers on a non-active listing', async () => {
      query.mockResolvedValueOnce([{ seller_id: 's1', status: 'sold' }]);
      await expect(
        service.makeOffer('buyer', 'l1', {} as never),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('upserts the offer and returns it', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 's1', status: 'active' }]) // listing lookup
        .mockResolvedValueOnce([]) // INSERT ... ON CONFLICT
        .mockResolvedValueOnce([
          {
            id: 'o1', listing_id: 'l1', buyer_id: 'buyer', offer_cents: 4500, message: null,
            status: 'pending', created_at: new Date('2026-06-12T00:00:00Z'),
            buyer_display_name: 'Bob', buyer_avatar_url: null,
          },
        ]); // getOffer SELECT
      const res = await service.makeOffer('buyer', 'l1', { offerCents: 4500 } as never);
      expect(res).toMatchObject({ id: 'o1', status: 'pending', offerCents: 4500, buyerDisplayName: 'Bob' });
    });
  });

  describe('respondToOffer', () => {
    it('forbids a non-seller', async () => {
      const { runner } = makeQueryRunner([
        [{ listing_id: 'l1', buyer_id: 'b1', seller_id: 'someone-else' }], // SELECT ... FOR UPDATE
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(
        service.respondToOffer('not-seller', 'o1', 'accepted'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(runner.rollbackTransaction).toHaveBeenCalled();
    });

    it('accepting marks the listing sold and declines the rest', async () => {
      const { runner, query: qrq } = makeQueryRunner([
        [{ listing_id: 'l1', buyer_id: 'b1', seller_id: 's1' }], // SELECT FOR UPDATE
        [], // UPDATE this offer -> accepted
        [], // UPDATE listings -> sold
        [], // UPDATE other pending offers -> declined
      ]);
      createQueryRunner.mockReturnValue(runner);
      // getOfferById runs on the pooled connection (this.db.query), not the runner.
      query.mockResolvedValueOnce([
        {
          id: 'o1', listing_id: 'l1', buyer_id: 'b1', offer_cents: 4500, message: null,
          status: 'accepted', created_at: new Date('2026-06-12T00:00:00Z'),
          buyer_display_name: 'Bob', buyer_avatar_url: null,
        },
      ]);

      const res = await service.respondToOffer('s1', 'o1', 'accepted');
      expect(res.status).toBe('accepted');
      // 4 statements: lock + accept + sell + decline-others
      expect(qrq).toHaveBeenCalledTimes(4);
      const sql = qrq.mock.calls.map((c) => String(c[0])).join(' | ');
      expect(sql).toContain("status = 'sold'");
      expect(runner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('listOffers', () => {
    it('seller scope binds exactly one param (no $2) — regression for the bind mismatch', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 'me' }]) // listing lookup -> caller is seller
        .mockResolvedValueOnce([]); // offers query
      await service.listOffers('me', 'l1');
      const [sql, params] = query.mock.calls[1]!;
      expect(String(sql)).not.toContain('$2');
      expect(params).toEqual(['l1']); // only the listing id — never an unused $2
    });

    it('buyer scope binds $2 and filters to their own offers', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 'someone-else' }]) // caller is not the seller
        .mockResolvedValueOnce([]);
      await service.listOffers('buyer', 'l1');
      const [sql, params] = query.mock.calls[1]!;
      expect(String(sql)).toContain('o.buyer_id = $2');
      expect(params).toEqual(['l1', 'buyer']);
    });
  });

  describe('toggleFavorite', () => {
    it('adds a favorite when none exists and returns the fresh count', async () => {
      query
        .mockResolvedValueOnce([{ id: 'l1' }]) // listing exists
        .mockResolvedValueOnce([]) // SELECT existing favorite -> none
        .mockResolvedValueOnce([]) // INSERT favorite
        .mockResolvedValueOnce([{ count: 3 }]); // SELECT count
      const res = await service.toggleFavorite('u1', 'l1');
      expect(res).toEqual({ listingId: 'l1', favorited: true, favoriteCount: 3 });
    });

    it('removes an existing favorite (toggle off)', async () => {
      query
        .mockResolvedValueOnce([{ id: 'l1' }]) // listing exists
        .mockResolvedValueOnce([{ x: 1 }]) // SELECT existing favorite -> present
        .mockResolvedValueOnce([]) // DELETE favorite
        .mockResolvedValueOnce([{ count: 2 }]); // SELECT count
      const res = await service.toggleFavorite('u1', 'l1');
      expect(res).toEqual({ listingId: 'l1', favorited: false, favoriteCount: 2 });
    });

    it('404s when the listing is missing', async () => {
      query.mockResolvedValueOnce([]); // listing lookup -> none
      await expect(service.toggleFavorite('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
