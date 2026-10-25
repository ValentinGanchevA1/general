import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { ListingsService } from './listings.service';
import { NotificationsService } from '../notifications/notifications.service';
import { S3Service } from '../../common/s3.service';

/** queryRunner whose query() drains a pre-seeded FIFO result queue. */
function makeQueryRunner(results: unknown[]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    return Promise.resolve(results.shift() ?? []);
  });
  const runner = {
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
    query,
  };
  return { runner, query, calls };
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

  const expectBilateralBlockPredicate = (sql: string, left: string, right: string): void => {
    expect(sql).toContain('user_blocks');
    expect(sql).toContain(`blocker_id = ${left}`);
    expect(sql).toContain(`blocked_id = ${right}`);
    expect(sql).toContain(`blocker_id = ${right}`);
    expect(sql).toContain(`blocked_id = ${left}`);
  };

  const listingDetailRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'l1',
    seller_id: 's1',
    title: 'Bike',
    description: null,
    thumbnail_url: null,
    price_cents: 10000,
    currency: 'USD',
    category: 'goods',
    status: 'active',
    mode: 'sell',
    visibility: 'public',
    created_at: new Date('2026-01-01T00:00:00Z'),
    expires_at: null,
    bumped_at: null,
    lat: 42.7,
    lng: 23.3,
    favorited_by_me: false,
    favorite_count: 0,
    seller_display_name: 'Seller',
    seller_avatar_url: null,
    ...overrides,
  });

  describe('create', () => {
    it('inserts and returns a summary (favoritedByMe false)', async () => {
      query.mockResolvedValueOnce([
        {
          id: 'l1',
          seller_id: 's1',
          title: 'Bike',
          price_cents: 10000,
          currency: 'USD',
          category: 'goods',
          status: 'active',
          mode: 'sell',
          thumbnail_url: null,
          favorite_count: 0,
          created_at: new Date('2026-01-01T00:00:00Z'),
        },
      ]);
      const res = await service.create('s1', {
        title: 'Bike',
        priceCents: 10000,
        category: 'goods',
        location: { lat: 42.7, lng: 23.3 },
      });
      expect(res).toMatchObject({ id: 'l1', title: 'Bike', favoritedByMe: false });
    });
  });

  describe('uploadImage', () => {
    it('decodes, uploads, and returns the public URL', async () => {
      const res = await service.uploadImage('s1', Buffer.from([0xff, 0xd8, 0xff, 0xd9]).toString('base64'), 'image/jpeg');
      expect(res).toEqual({ url: 'https://cdn.example/listings/s1/x.jpg' });
      expect(uploadListingImageBuffer).toHaveBeenCalled();
    });

    it('rejects empty/invalid base64 without hitting S3', async () => {
      await expect(service.uploadImage('s1', '', 'image/jpeg')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an image over the 10 MB cap', async () => {
      const big = Buffer.alloc(11 * 1024 * 1024).toString('base64');
      await expect(service.uploadImage('s1', big, 'image/png')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('block isolation', () => {
    it('filters listings sold by either side of a block from browse', async () => {
      query.mockResolvedValueOnce([]);

      await service.browse('viewer', { location: { lat: 42.7, lng: 23.3 } } as never);

      const [sql, params] = query.mock.calls[0]!;
      expectBilateralBlockPredicate(String(sql), '$1', 'l.seller_id');
      expect(params[0]).toBe('viewer');
    });

    it('treats a private or blocked-seller listing as not found on detail', async () => {
      query.mockResolvedValueOnce([]);

      await expect(service.detail('viewer', 'l1')).rejects.toBeInstanceOf(NotFoundException);

      expect(query).toHaveBeenCalledTimes(1);
      const [sql] = query.mock.calls[0]!;
      expect(String(sql)).toContain("l.visibility = 'public' OR l.seller_id = $1");
      expectBilateralBlockPredicate(String(sql), '$1', 'l.seller_id');
    });

    it('excludes blocked users from seller-facing favorite and pending-offer aggregates', async () => {
      query
        .mockResolvedValueOnce([listingDetailRow()])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ open_offers: 2 }]);

      const detail = await service.detail('s1', 'l1');

      expect(detail.offerCount).toBe(2);
      const detailSql = String(query.mock.calls[0]![0]);
      expectBilateralBlockPredicate(detailSql, 'l.seller_id', 'tf.user_id');
      const [offersSql, offersParams] = query.mock.calls[2]!;
      expectBilateralBlockPredicate(String(offersSql), '$2', 'o.buyer_id');
      expect(offersParams).toEqual(['l1', 's1']);
    });
  });

  describe('makeOffer', () => {
    it('forbids the seller offering on their own listing', async () => {
      query.mockResolvedValueOnce([{ seller_id: 'me', status: 'active' }]);
      await expect(
        service.makeOffer('me', 'l1', { offerCents: 100 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('hides a private or blocked-seller listing before an offer can be inserted', async () => {
      query.mockResolvedValueOnce([]);

      await expect(
        service.makeOffer('b1', 'l1', { offerCents: 100 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(query).toHaveBeenCalledTimes(1);
      const [sql, params] = query.mock.calls[0]!;
      expectBilateralBlockPredicate(String(sql), '$2', 'l.seller_id');
      expect(params).toEqual(['l1', 'b1']);
    });

    it('rejects offers on a non-active listing', async () => {
      query.mockResolvedValueOnce([{ seller_id: 's1', status: 'sold' }]);
      await expect(
        service.makeOffer('b1', 'l1', { offerCents: 100 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('upserts the offer and returns it', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 's1', status: 'active' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'o1',
            listing_id: 'l1',
            buyer_id: 'b1',
            offer_cents: 4500,
            message: null,
            status: 'pending',
            last_actor: 'buyer',
            created_at: new Date('2026-06-12T00:00:00Z'),
            buyer_display_name: 'Bob',
            buyer_avatar_url: null,
          },
        ]);

      const res = await service.makeOffer('b1', 'l1', { offerCents: 4500 });
      expect(res).toMatchObject({ id: 'o1', status: 'pending', offerCents: 4500, buyerDisplayName: 'Bob' });
    });
  });

  describe('counterOffer', () => {
    it('hides an offer when buyer and seller are blocked in either direction', async () => {
      query.mockResolvedValueOnce([]);

      await expect(
        service.counterOffer('s1', 'o1', { offerCents: 5000 } as never),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(query).toHaveBeenCalledTimes(1);
      expectBilateralBlockPredicate(String(query.mock.calls[0]![0]), 'l.seller_id', 'o.buyer_id');
    });
  });

  describe('respondToOffer', () => {
    it('hides a blocked buyer/seller offer before any transactional mutation', async () => {
      const { runner, calls } = makeQueryRunner([[]]);
      createQueryRunner.mockReturnValue(runner);

      await expect(
        service.respondToOffer('s1', 'o1', 'accepted'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(calls).toHaveLength(1);
      expectBilateralBlockPredicate(calls[0]!.sql, 'l.seller_id', 'o.buyer_id');
      expect(runner.rollbackTransaction).toHaveBeenCalled();
    });

    it('forbids a non-seller', async () => {
      const { runner } = makeQueryRunner([
        [{
          listing_id: 'l1', buyer_id: 'b1', seller_id: 'someone-else',
          offer_status: 'pending', listing_status: 'active', last_actor: 'buyer',
        }],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(
        service.respondToOffer('not-seller', 'o1', 'accepted'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(runner.rollbackTransaction).toHaveBeenCalled();
    });

    it('accepting marks the listing sold and declines the rest', async () => {
      const { runner, query: qrq } = makeQueryRunner([
        [{
          listing_id: 'l1', buyer_id: 'b1', seller_id: 's1',
          offer_status: 'pending', listing_status: 'active', last_actor: 'buyer',
        }], // SELECT FOR UPDATE
        [], // UPDATE this offer -> accepted
        [], // UPDATE listings -> sold
        [], // UPDATE other pending offers -> declined
      ]);
      createQueryRunner.mockReturnValue(runner);
      // getOfferById runs on the pooled connection (this.db.query), not the runner.
      query.mockResolvedValueOnce([
        {
          id: 'o1', listing_id: 'l1', buyer_id: 'b1', offer_cents: 4500, message: null,
          status: 'accepted', last_actor: 'buyer', created_at: new Date('2026-06-12T00:00:00Z'),
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
    it('seller scope hides blocked buyers while keeping the seller as the access viewer', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 'me' }])
        .mockResolvedValueOnce([]);
      await service.listOffers('me', 'l1');
      const [accessSql, accessParams] = query.mock.calls[0]!;
      expectBilateralBlockPredicate(String(accessSql), '$1', 'l.seller_id');
      expect(accessParams).toEqual(['me', 'l1']);
      const [sql, params] = query.mock.calls[1]!;
      expect(String(sql)).not.toContain('AND o.buyer_id = $2');
      expectBilateralBlockPredicate(String(sql), '$2', 'o.buyer_id');
      expect(params).toEqual(['l1', 'me']);
    });

    it('buyer scope binds $2 and filters to their own offers after listing access is allowed', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 'someone-else' }])
        .mockResolvedValueOnce([]);
      await service.listOffers('buyer', 'l1');
      const [sql, params] = query.mock.calls[1]!;
      expect(String(sql)).toContain('o.buyer_id = $2');
      expect(params).toEqual(['l1', 'buyer']);
    });

    it('does not reveal offers for an inaccessible listing', async () => {
      query.mockResolvedValueOnce([]);

      await expect(service.listOffers('buyer', 'l1')).rejects.toBeInstanceOf(NotFoundException);
      expect(query).toHaveBeenCalledTimes(1);
    });
  });

  describe('toggleFavorite', () => {
    it('adds a favorite when none exists and returns the fresh privacy-filtered count', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 's1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 3 }]);
      const res = await service.toggleFavorite('u1', 'l1');
      expect(res).toEqual({ listingId: 'l1', favorited: true, favoriteCount: 3 });
      expectBilateralBlockPredicate(String(query.mock.calls[3]![0]), 'l.seller_id', 'tf.user_id');
    });

    it('removes an existing favorite (toggle off)', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 's1' }])
        .mockResolvedValueOnce([{ x: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 2 }]);
      const res = await service.toggleFavorite('u1', 'l1');
      expect(res).toEqual({ listingId: 'l1', favorited: false, favoriteCount: 2 });
    });

    it('404s before favorite mutation when the listing is missing, private, or blocked', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.toggleFavorite('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
      expect(query).toHaveBeenCalledTimes(1);
      expectBilateralBlockPredicate(String(query.mock.calls[0]![0]), '$1', 'l.seller_id');
    });
  });

  describe('listFavorites', () => {
    it('does not return saved listings whose seller is now blocked or inaccessible', async () => {
      query.mockResolvedValueOnce([]);

      await service.listFavorites('viewer');

      const [sql, params] = query.mock.calls[0]!;
      expect(String(sql)).toContain("l.visibility = 'public' OR l.seller_id = $1");
      expectBilateralBlockPredicate(String(sql), '$1', 'l.seller_id');
      expect(params).toEqual(['viewer']);
    });
  });
});
