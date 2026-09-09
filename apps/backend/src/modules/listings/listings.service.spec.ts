import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
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

describe('ListingsService', () => {
  let service: ListingsService;
  let query: jest.Mock;
  let createQueryRunner: jest.Mock;

  beforeEach(() => {
    query = jest.fn();
    createQueryRunner = jest.fn();
    service = new ListingsService(makeDb(query, createQueryRunner));
  });

  describe('makeOffer', () => {
    it('rejects when the listing is missing', async () => {
      query.mockResolvedValueOnce([]); // listing lookup
      await expect(
        service.makeOffer('buyer', 'missing', { offerCents: 100 }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects when the buyer is the seller', async () => {
      query.mockResolvedValueOnce([{ seller_id: 'me', status: 'active' }]);
      await expect(
        service.makeOffer('me', 'l1', { offerCents: 100 }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when the listing is not active', async () => {
      query.mockResolvedValueOnce([{ seller_id: 's1', status: 'sold' }]);
      await expect(
        service.makeOffer('b1', 'l1', { offerCents: 100 }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('upserts an offer and returns the mapped card', async () => {
      query
        .mockResolvedValueOnce([{ seller_id: 's1', status: 'active' }]) // listing
        .mockResolvedValueOnce([]) // upsert
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
        ]); // getOffer

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
        }], // SELECT ... FOR UPDATE
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
  });
});
