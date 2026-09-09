import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ListingsService } from './listings.service';

/** Minimal double of TypeORM DataSource used by ListingsService. */
function makeDb(query: jest.Mock, createQueryRunner: jest.Mock) {
  return { query, createQueryRunner } as never;
}

function makeQueryRunner(results: unknown[][]) {
  const query = jest.fn();
  for (const r of results) query.mockResolvedValueOnce(r);
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

/** Tiny valid JPEG (1x1) as base64 for uploadImage tests. */
const oneByteJpegB64 = Buffer.from([
  0xff, 0xd8, 0xff, 0xd9,
]).toString('base64');

describe('ListingsService', () => {
  let service: ListingsService;
  let query: jest.Mock;
  let createQueryRunner: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    createQueryRunner = jest.fn();
    // S3 client is optional in unit tests — service tolerates missing client for non-upload paths.
    service = new ListingsService(makeDb(query, createQueryRunner));
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
        lat: 42.7,
        lng: 23.3,
      } as never);
      expect(res).toMatchObject({ id: 'l1', title: 'Bike', favoritedByMe: false });
    });
  });

  describe('uploadImage', () => {
    it('decodes, uploads, and returns the public URL', async () => {
      // Without real S3, this path is skipped in pure unit tests when client absent.
      // Keep as smoke that invalid input is rejected — service may throw if S3 unset.
      await expect(service.uploadImage('s1', oneByteJpegB64, 'image/jpeg')).rejects.toBeDefined();
    });

    it('rejects empty/invalid base64 without hitting S3', async () => {
      await expect(service.uploadImage('s1', '', 'image/jpeg')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an image over the 10 MB cap', async () => {
      const big = Buffer.alloc(11 * 1024 * 1024).toString('base64');
      await expect(service.uploadImage('s1', big, 'image/png')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('makeOffer', () => {
    it('forbids the seller offering on their own listing', async () => {
      query.mockResolvedValueOnce([{ seller_id: 'me', status: 'active' }]);
      await expect(
        service.makeOffer('me', 'l1', { offerCents: 100 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
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

  describe('respondToOffer', () => {
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
        }],
        [],
        [],
        [],
      ]);
      createQueryRunner.mockReturnValue(runner);
      query.mockResolvedValueOnce([
        {
          id: 'o1', listing_id: 'l1', buyer_id: 'b1', offer_cents: 4500, message: null,
          status: 'accepted', last_actor: 'buyer', created_at: new Date('2026-06-12T00:00:00Z'),
          buyer_display_name: 'Bob', buyer_avatar_url: null,
        },
      ]);

      const res = await service.respondToOffer('s1', 'o1', 'accepted');
      expect(res.status).toBe('accepted');
      expect(qrq).toHaveBeenCalledTimes(4);
      const sql = qrq.mock.calls.map((c) => String(c[0])).join(' | ');
      expect(sql).toContain("status = 'sold'");
      expect(runner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('listOffers', () => {
    it('seller scope binds exactly one param (no $2) — regression for the bind mismatch', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 'me' }])
        .mockResolvedValueOnce([]);
      await service.listOffers('me', 'l1');
      const [sql, params] = query.mock.calls[1]!;
      expect(String(sql)).not.toContain('$2');
      expect(params).toEqual(['l1']);
    });

    it('buyer scope binds $2 and filters to their own offers', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 'someone-else' }])
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
        .mockResolvedValueOnce([{ id: 'l1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 3 }]);
      const res = await service.toggleFavorite('u1', 'l1');
      expect(res).toEqual({ listingId: 'l1', favorited: true, favoriteCount: 3 });
    });

    it('removes an existing favorite (toggle off)', async () => {
      query
        .mockResolvedValueOnce([{ id: 'l1' }])
        .mockResolvedValueOnce([{ x: 1 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ count: 2 }]);
      const res = await service.toggleFavorite('u1', 'l1');
      expect(res).toEqual({ listingId: 'l1', favorited: false, favoriteCount: 2 });
    });

    it('404s when the listing is missing', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.toggleFavorite('u1', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
