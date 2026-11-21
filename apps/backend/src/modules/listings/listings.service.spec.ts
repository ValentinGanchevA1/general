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

  const expectTransactionRollback = (
    runner: ReturnType<typeof makeQueryRunner>['runner'],
    calls: ReturnType<typeof makeQueryRunner>['calls'],
    expectedCalls: number,
  ): void => {
    expect(calls).toHaveLength(expectedCalls);
    expect(runner.rollbackTransaction).toHaveBeenCalled();
    expect(runner.commitTransaction).not.toHaveBeenCalled();
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
      const { runner } = makeQueryRunner([[{ seller_id: 'me', status: 'active' }]]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.makeOffer('me', 'l1', { offerCents: 100 }))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(runner.rollbackTransaction).toHaveBeenCalled();
      expect(runner.commitTransaction).not.toHaveBeenCalled();
    });

    it('hides a private or blocked-seller listing before an offer can be inserted', async () => {
      const { runner, calls } = makeQueryRunner([[]]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.makeOffer('b1', 'l1', { offerCents: 100 }))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(calls).toHaveLength(1);
      expect(calls[0]!.sql).toContain('FOR UPDATE OF l');
      expectBilateralBlockPredicate(calls[0]!.sql, '$2', 'l.seller_id');
      expect(calls[0]!.params).toEqual(['l1', 'b1']);
      expect(runner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rejects offers on a sold listing without upserting', async () => {
      const { runner, calls } = makeQueryRunner([[{ seller_id: 's1', status: 'sold' }]]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.makeOffer('b1', 'l1', { offerCents: 100 }))
        .rejects.toBeInstanceOf(ConflictException);
      expectTransactionRollback(runner, calls, 1);
    });

    it('upserts the offer inside the listing transaction and returns it', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ seller_id: 's1', status: 'active' }],
        [[{ id: 'o1' }], 1],
      ]);
      createQueryRunner.mockReturnValue(runner);
      query.mockResolvedValueOnce([{
        id: 'o1', listing_id: 'l1', buyer_id: 'b1', offer_cents: 4500,
        message: null, status: 'pending', last_actor: 'buyer',
        created_at: new Date('2026-06-12T00:00:00Z'),
        buyer_display_name: 'Bob', buyer_avatar_url: null,
      }]);
      const res = await service.makeOffer('b1', 'l1', { offerCents: 4500 });
      expect(res).toMatchObject({ id: 'o1', status: 'pending', offerCents: 4500 });
      expect(calls).toHaveLength(2);
      expect(calls[0]!.sql).toContain('FOR UPDATE OF l');
      expect(calls[1]!.sql).toContain('ON CONFLICT');
      expect(runner.commitTransaction).toHaveBeenCalled();
      expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it.each(['withdrawn', 'declined', 'accepted'] as const)(
      'does not reopen a %s offer when the listing remains active', async () => {
        const { runner, calls } = makeQueryRunner([
          [{ seller_id: 's1', status: 'active' }],
          [[], 0],
        ]);
        createQueryRunner.mockReturnValue(runner);
        await expect(service.makeOffer('b1', 'l1', { offerCents: 4500 }))
          .rejects.toBeInstanceOf(ConflictException);
        expect(calls).toHaveLength(2);
        expect(calls[1]!.sql).toContain("WHERE trade_offers.status = 'pending'");
        expect(calls[1]!.sql).toContain('RETURNING id');
        expect(runner.rollbackTransaction).toHaveBeenCalled();
        expect(runner.commitTransaction).not.toHaveBeenCalled();
      },
    );
    it('rolls back when the offer upsert fails', async () => {
      const { runner, query: runnerQuery } = makeQueryRunner([]);
      runnerQuery
        .mockResolvedValueOnce([{ seller_id: 's1', status: 'active' }])
        .mockRejectedValueOnce(new Error('synthetic insert failure'));
      createQueryRunner.mockReturnValue(runner);
      await expect(service.makeOffer('b1', 'l1', { offerCents: 4500 }))
        .rejects.toThrow('synthetic insert failure');
      expect(runner.rollbackTransaction).toHaveBeenCalled();
      expect(runner.commitTransaction).not.toHaveBeenCalled();
    });
  });
  describe('counterOffer', () => {
    it('hides an offer when buyer and seller are blocked in either direction', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ listing_id: 'l1' }],
        [{ id: 'l1' }],
        [],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(
        service.counterOffer('s1', 'o1', { offerCents: 5000 } as never),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(calls).toHaveLength(3);
      expectBilateralBlockPredicate(calls[2]!.sql, 'l.seller_id', 'o.buyer_id');
      expect(runner.rollbackTransaction).toHaveBeenCalled();
      expect(runner.commitTransaction).not.toHaveBeenCalled();
    });

    it('locks listing before offer and commits an authorized pending counter', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ listing_id: 'l1' }],
        [{ id: 'l1' }],
        [{
          id: 'o1', listing_id: 'l1', buyer_id: 'b1', seller_id: 's1',
          status: 'pending', listing_status: 'active',
        }],
        [[{ id: 'o1' }], 1],
      ]);
      createQueryRunner.mockReturnValue(runner);
      query.mockResolvedValueOnce([{
        id: 'o1', listing_id: 'l1', buyer_id: 'b1', offer_cents: 5000,
        message: null, status: 'pending', last_actor: 'seller',
        created_at: new Date('2026-06-12T00:00:00Z'),
        buyer_display_name: 'Bob', buyer_avatar_url: null,
      }]);
      const result = await service.counterOffer('s1', 'o1', { offerCents: 5000 } as never);
      expect(result.status).toBe('pending');
      expect(calls).toHaveLength(4);
      expect(calls[1]!.sql).toContain('FROM listings');
      expect(calls[1]!.sql).toContain('FOR UPDATE');
      expect(calls[2]!.sql).toContain('FOR UPDATE OF o');
      expect(calls[3]!.sql).toContain("status = 'pending'");
      expect(calls[3]!.sql).toContain('RETURNING id');
      expect(runner.commitTransaction).toHaveBeenCalled();
      expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('rolls back if the offer was already changed', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ listing_id: 'l1' }],
        [{ id: 'l1' }],
        [{
          id: 'o1', listing_id: 'l1', buyer_id: 'b1', seller_id: 's1',
          status: 'accepted', listing_status: 'active',
        }],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.counterOffer('s1', 'o1', { offerCents: 5000 } as never))
        .rejects.toBeInstanceOf(ConflictException);
      expectTransactionRollback(runner, calls, 3);
    });

    it('rolls back when a conditional offer update returns no rows', async () => {
      const { runner } = makeQueryRunner([
        [{ listing_id: 'l1' }],
        [{ id: 'l1' }],
        [{
          id: 'o1', listing_id: 'l1', buyer_id: 'b1', seller_id: 's1',
          status: 'pending', listing_status: 'active',
        }],
        [[], 0],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.counterOffer('s1', 'o1', { offerCents: 5000 } as never))
        .rejects.toBeInstanceOf(ConflictException);
      expect(runner.rollbackTransaction).toHaveBeenCalled();
      expect(runner.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('respondToOffer', () => {
    it('hides a blocked buyer/seller offer before any transactional mutation', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ listing_id: 'l1' }], // Look up listing without locking offer
        [{ id: 'l1' }], // Lock listing first
        [], // Offer query excludes blocked users
      ]);
      createQueryRunner.mockReturnValue(runner);

      await expect(
        service.respondToOffer('s1', 'o1', 'accepted'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(calls).toHaveLength(3);
      expectBilateralBlockPredicate(calls[2]!.sql, 'l.seller_id', 'o.buyer_id');
      expect(runner.rollbackTransaction).toHaveBeenCalled();
      expect(runner.commitTransaction).not.toHaveBeenCalled();
    });

    it('forbids a non-seller', async () => {
      const { runner } = makeQueryRunner([
        [{ listing_id: 'l1' }],
        [{ id: 'l1' }],
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
      expect(runner.commitTransaction).not.toHaveBeenCalled();
    });

    it('accepting marks the listing sold and declines the rest', async () => {
      const { runner, query: qrq } = makeQueryRunner([
        [{ listing_id: 'l1' }], // Resolve listing ID
        [{ id: 'l1' }], // Lock listing
        [{
          listing_id: 'l1', buyer_id: 'b1', seller_id: 's1',
          offer_status: 'pending', listing_status: 'active', last_actor: 'buyer',
           }], // Lock offer and validate authorization
        [[{ id: 'o1' }], 1], // UPDATE offer RETURNING id
        [[{ id: 'l1' }], 1], // UPDATE listings -> sold RETURNING id
        [], // UPDATE other pending offers -> declined
      ]);
      createQueryRunner.mockReturnValue(runner);
      // getOfferById runs on the pooled connection (this.db.query), not the runner.
      query.mockResolvedValueOnce([{
        id: 'o1', listing_id: 'l1', buyer_id: 'b1', offer_cents: 4500, message: null,
        status: 'accepted', last_actor: 'buyer', created_at: new Date('2026-06-12T00:00:00Z'),
        buyer_display_name: 'Bob', buyer_avatar_url: null,
      }]);

      const res = await service.respondToOffer('s1', 'o1', 'accepted');
      expect(res.status).toBe('accepted');
      expect(qrq).toHaveBeenCalledTimes(6);

      const sqlCalls = qrq.mock.calls.map((call) => String(call[0]));
      expect(sqlCalls[0]).toContain('SELECT listing_id');
      expect(sqlCalls[1]).toContain('FROM listings');
      expect(sqlCalls[1]).toContain('FOR UPDATE');
      expect(sqlCalls[2]).toContain('FOR UPDATE OF o');
      expect(sqlCalls[4]).toContain("status = 'active'");
      expect(sqlCalls[4]).toContain('RETURNING id');
      expect(runner.commitTransaction).toHaveBeenCalled();
      expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('rolls back when another offer already sold the listing', async () => {
      const { runner, query: qrq } = makeQueryRunner([
        [{ listing_id: 'l1' }],
        [{ id: 'l1' }],
        [{
          listing_id: 'l1', buyer_id: 'b1', seller_id: 's1',
          offer_status: 'pending', listing_status: 'active', last_actor: 'buyer',
        }],
        [[{ id: 'o1' }], 1], // UPDATE offer RETURNING id
        [[], 0], // Conditional UPDATE listings returns no rows
      ]);
      createQueryRunner.mockReturnValue(runner);

      await expect(
        service.respondToOffer('s1', 'o1', 'accepted'),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(qrq).toHaveBeenCalledTimes(5);
      expect(String(qrq.mock.calls[4]![0])).toContain("status = 'active'");
      expect(String(qrq.mock.calls[4]![0])).toContain('RETURNING id');
      expect(runner.rollbackTransaction).toHaveBeenCalled();
      expect(runner.commitTransaction).not.toHaveBeenCalled();
    });

    it('rolls back when conditional offer update affects zero rows', async () => {
      const { runner, query: qrq } = makeQueryRunner([
        [{ listing_id: 'l1' }],
        [{ id: 'l1' }],
        [{
          listing_id: 'l1', buyer_id: 'b1', seller_id: 's1',
          offer_status: 'pending', listing_status: 'active', last_actor: 'buyer',
        }],
        [[], 0],
      ]);
      createQueryRunner.mockReturnValue(runner);

      await expect(
        service.respondToOffer('s1', 'o1', 'accepted'),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(qrq).toHaveBeenCalledTimes(4);
      expect(String(qrq.mock.calls[3]![0])).toContain("status = 'pending'");
      expect(String(qrq.mock.calls[3]![0])).toContain('RETURNING id');
      expect(runner.rollbackTransaction).toHaveBeenCalled();
      expect(runner.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus lifecycle', () => {
    it('manually sells an active listing and declines outstanding pending offers', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', seller_id: 's1', status: 'active' }],
        [[{ id: 'l1' }], 1],
        [[], 2],
      ]);
      createQueryRunner.mockReturnValue(runner);
      // get detail after commit is a separate API read; mock it to isolate mutation.
      jest.spyOn(service, 'detail').mockResolvedValueOnce({ status: 'sold' } as never);
      const result = await service.updateStatus('s1', 'l1', 'sold');
      expect(result.status).toBe('sold');
      expect(calls).toHaveLength(3);
      expect(calls[0]!.sql).toContain('FOR UPDATE');
      expect(calls[0]!.sql).toContain('FROM listings');
      expect(calls[1]!.sql).toContain("status = 'active'");
      expect(calls[1]!.params).toEqual(['l1', 'sold', 's1']);
      expect(calls[2]!.sql).toContain('UPDATE trade_offers');
      expect(calls[2]!.sql).toContain("status = 'pending'");
      expect(runner.commitTransaction).toHaveBeenCalled();
      expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('withdraws active listing and declines pending offers atomically', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', seller_id: 's1', status: 'active' }],
        [[{ id: 'l1' }], 1],
        [[], 2],
      ]);
      createQueryRunner.mockReturnValue(runner);
      jest.spyOn(service, 'detail').mockResolvedValueOnce({ status: 'withdrawn' } as never);
      await service.updateStatus('s1', 'l1', 'withdrawn');
      expect(calls[1]!.params).toEqual(['l1', 'withdrawn', 's1']);
      expect(calls[2]!.sql).toContain('UPDATE trade_offers');
      expect(runner.commitTransaction).toHaveBeenCalled();
    });

    it('treats same status as idempotent without mutating offers', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', seller_id: 's1', status: 'active' }],
      ]);
      createQueryRunner.mockReturnValue(runner);
      jest.spyOn(service, 'detail').mockResolvedValueOnce({ status: 'active' } as never);
      await service.updateStatus('s1', 'l1', 'active');
      expect(calls).toHaveLength(1);
      expect(runner.commitTransaction).toHaveBeenCalled();
    });

    it.each([
      ['sold', 'active'],
      ['sold', 'withdrawn'],
      ['withdrawn', 'active'],
      ['withdrawn', 'sold'],
    ] as const)('rejects terminal listing transition %s -> %s', async (current, next) => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', seller_id: 's1', status: current }],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.updateStatus('s1', 'l1', next))
        .rejects.toBeInstanceOf(ConflictException);
      expectTransactionRollback(runner, calls, 1);
    });

    it('rejects a different seller before writing', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', seller_id: 's1', status: 'active' }],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.updateStatus('other', 'l1', 'sold'))
        .rejects.toBeInstanceOf(ForbiddenException);
      expect(calls).toHaveLength(1);
      expect(runner.rollbackTransaction).toHaveBeenCalled();
    });

    it('returns not found for a missing or deleted listing', async () => {
      const { runner, calls } = makeQueryRunner([[]]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.updateStatus('s1', 'missing', 'sold'))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(calls).toHaveLength(1);
      expect(runner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rolls back when conditional listing update affects zero rows', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', seller_id: 's1', status: 'active' }],
        [[], 0],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.updateStatus('s1', 'l1', 'sold'))
        .rejects.toBeInstanceOf(ConflictException);
      expectTransactionRollback(runner, calls, 2);
    });
  });
  describe('withdrawOffer', () => {
    it('locks listing before buyer offer and withdraws only pending offer', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', status: 'active' }],
        [{ id: 'o1', status: 'pending' }],
        [[{ id: 'o1' }], 1],
      ]);
      createQueryRunner.mockReturnValue(runner);
      query.mockResolvedValueOnce([{
        id: 'o1', listing_id: 'l1', buyer_id: 'b1', offer_cents: 4500,
        message: null, status: 'withdrawn', last_actor: 'buyer',
        created_at: new Date('2026-06-12T00:00:00Z'),
        buyer_display_name: 'Bob', buyer_avatar_url: null,
      }]);

      const result = await service.withdrawOffer('b1', 'l1');
      expect(result.status).toBe('withdrawn');
      expect(calls).toHaveLength(3);
      expect(calls[0]!.sql).toContain('FROM listings');
      expect(calls[0]!.sql).toContain('FOR UPDATE');
      expect(calls[1]!.sql).toContain('buyer_id = $2 FOR UPDATE');
      expect(calls[1]!.params).toEqual(['l1', 'b1']);
      expect(calls[2]!.sql).toContain("status = 'pending'");
      expect(calls[2]!.sql).toContain('RETURNING id');
      expect(runner.commitTransaction).toHaveBeenCalled();
      expect(runner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('does not overwrite an accepted offer', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', status: 'active' }],
        [{ id: 'o1', status: 'accepted' }],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.withdrawOffer('b1', 'l1'))
        .rejects.toBeInstanceOf(ConflictException);
      expectTransactionRollback(runner, calls, 2);
    });

    it('does not withdraw an offer on a sold listing', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', status: 'sold' }],
        [{ id: 'o1', status: 'pending' }],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.withdrawOffer('b1', 'l1'))
        .rejects.toBeInstanceOf(ConflictException);
      expectTransactionRollback(runner, calls, 2);
    });

    it('does not disclose or mutate another buyer offer', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', status: 'active' }],
        [],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.withdrawOffer('different-buyer', 'l1'))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(calls).toHaveLength(2);
      expect(calls[1]!.params).toEqual(['l1', 'different-buyer']);
      expect(runner.rollbackTransaction).toHaveBeenCalled();
    });

    it('rolls back if the conditional withdraw returns no rows', async () => {
      const { runner, calls } = makeQueryRunner([
        [{ id: 'l1', status: 'active' }],
        [{ id: 'o1', status: 'pending' }],
        [[], 0],
      ]);
      createQueryRunner.mockReturnValue(runner);
      await expect(service.withdrawOffer('b1', 'l1'))
        .rejects.toBeInstanceOf(ConflictException);
      expectTransactionRollback(runner, calls, 3);
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