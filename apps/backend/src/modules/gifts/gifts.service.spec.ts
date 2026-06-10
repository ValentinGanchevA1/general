// apps/backend/src/modules/gifts/gifts.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { GiftsService } from './gifts.service';
import { GamificationService } from '../gamification/gamification.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { SendGiftDto } from './dto';

const flush = () => new Promise<void>((res) => setImmediate(res));

describe('GiftsService', () => {
  let service: GiftsService;
  let query: jest.Mock; // non-transactional db.query
  let qrQuery: jest.Mock; // transactional queryRunner.query
  let qr: {
    connect: jest.Mock;
    startTransaction: jest.Mock;
    commitTransaction: jest.Mock;
    rollbackTransaction: jest.Mock;
    release: jest.Mock;
    query: jest.Mock;
  };
  let award: jest.Mock;
  let emitGiftReceived: jest.Mock;

  const GIFT = { id: 'g1', cost_xp: 100, emoji: '🎁', label: 'Box' };

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    qrQuery = jest.fn().mockResolvedValue([]);
    qr = {
      connect: jest.fn().mockResolvedValue(undefined),
      startTransaction: jest.fn().mockResolvedValue(undefined),
      commitTransaction: jest.fn().mockResolvedValue(undefined),
      rollbackTransaction: jest.fn().mockResolvedValue(undefined),
      release: jest.fn().mockResolvedValue(undefined),
      query: qrQuery,
    };
    const createQueryRunner = jest.fn(() => qr);
    award = jest.fn().mockResolvedValue(undefined);
    emitGiftReceived = jest.fn().mockResolvedValue(undefined);

    const mod = await Test.createTestingModule({
      providers: [
        GiftsService,
        {
          provide: getDataSourceToken(),
          useValue: { query, createQueryRunner } as unknown as DataSource,
        },
        { provide: GamificationService, useValue: { award } },
        { provide: RealtimeGateway, useValue: { emitGiftReceived } },
      ],
    }).compile();
    service = mod.get(GiftsService);
  });

  const dto = (over: Partial<SendGiftDto> = {}): SendGiftDto => ({
    recipientId: 'recipient',
    giftId: 'g1',
    ...over,
  });

  describe('send — validation guards', () => {
    it('refuses a gift to yourself before any DB work', async () => {
      await expect(
        service.send('me', dto({ recipientId: 'me' })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(query).not.toHaveBeenCalled();
      expect(qr.connect).not.toHaveBeenCalled();
    });

    it('rejects an unknown / inactive gift', async () => {
      query.mockResolvedValueOnce([]); // catalog lookup: none
      await expect(service.send('me', dto())).rejects.toBeInstanceOf(NotFoundException);
      expect(qr.connect).not.toHaveBeenCalled();
    });

    it('rejects a missing recipient', async () => {
      query
        .mockResolvedValueOnce([GIFT]) // catalog
        .mockResolvedValueOnce([]); // recipient lookup: none
      await expect(service.send('me', dto())).rejects.toBeInstanceOf(NotFoundException);
      expect(qr.connect).not.toHaveBeenCalled();
    });
  });

  describe('send — atomic debit (double-spend guard)', () => {
    it('rolls back without debiting when the wallet is short', async () => {
      query
        .mockResolvedValueOnce([GIFT])
        .mockResolvedValueOnce([{ id: 'recipient' }]);
      qrQuery.mockResolvedValueOnce([{ spendable_xp: 50 }]); // wallet FOR UPDATE < cost

      await expect(service.send('me', dto())).rejects.toBeInstanceOf(BadRequestException);

      // Only the locking SELECT ran — no UPDATE/INSERT.
      expect(qrQuery).toHaveBeenCalledTimes(1);
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(qr.release).toHaveBeenCalledTimes(1);
    });

    it('locks, debits, inserts and commits on the happy path', async () => {
      query
        .mockResolvedValueOnce([GIFT])
        .mockResolvedValueOnce([{ id: 'recipient' }]);
      qrQuery
        .mockResolvedValueOnce([{ spendable_xp: 500 }]) // SELECT ... FOR UPDATE
        .mockResolvedValueOnce([]) // UPDATE debit
        .mockResolvedValueOnce([{ id: 'gift1', createdAt: '2026-06-10T00:00:00Z' }]); // INSERT RETURNING

      const res = await service.send('me', dto({ message: 'hi' }));

      expect(res).toEqual({ giftId: 'gift1', spendableXp: 400 });

      // Debit is the cost, scoped to the sender.
      const debit = qrQuery.mock.calls[1]!;
      expect(debit[0]).toContain('spendable_xp = spendable_xp - $2');
      expect(debit[1]).toEqual(['me', 100]);

      // FOR UPDATE lock present on the balance read.
      expect(qrQuery.mock.calls[0]![0]).toContain('FOR UPDATE');

      expect(qr.commitTransaction).toHaveBeenCalledTimes(1);
      expect(qr.rollbackTransaction).not.toHaveBeenCalled();
      expect(qr.release).toHaveBeenCalledTimes(1);
    });

    it('rewards the recipient idempotently and delivers, post-commit', async () => {
      query
        .mockResolvedValueOnce([GIFT])
        .mockResolvedValueOnce([{ id: 'recipient' }]);
      qrQuery
        .mockResolvedValueOnce([{ spendable_xp: 500 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'gift1', createdAt: '2026-06-10T00:00:00Z' }]);

      await service.send('me', dto());
      await flush(); // let the fire-and-forget reward + delivery settle

      expect(award).toHaveBeenCalledWith('recipient', 'gift.received', {
        dedupeKey: 'gift:gift1',
      });
      expect(emitGiftReceived).toHaveBeenCalledWith('recipient', expect.objectContaining({ id: 'gift1' }));
    });

    it('rolls back and propagates if the insert fails mid-transaction', async () => {
      query
        .mockResolvedValueOnce([GIFT])
        .mockResolvedValueOnce([{ id: 'recipient' }]);
      qrQuery
        .mockResolvedValueOnce([{ spendable_xp: 500 }])
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('insert boom'));

      await expect(service.send('me', dto())).rejects.toThrow('insert boom');
      expect(qr.commitTransaction).not.toHaveBeenCalled();
      expect(qr.rollbackTransaction).toHaveBeenCalledTimes(1);
      expect(qr.release).toHaveBeenCalledTimes(1);
      expect(award).not.toHaveBeenCalled();
    });
  });

  describe('balance', () => {
    it('returns the spendable balance', async () => {
      query.mockResolvedValueOnce([{ spendable_xp: 250 }]);
      await expect(service.balance('me')).resolves.toEqual({ spendableXp: 250 });
    });

    it('defaults to 0 when the user has no wallet row', async () => {
      query.mockResolvedValueOnce([]);
      await expect(service.balance('me')).resolves.toEqual({ spendableXp: 0 });
    });
  });

  describe('catalog', () => {
    it('returns active catalog items', async () => {
      const items = [{ id: 'g1', label: 'Box', emoji: '🎁', costXp: 100 }];
      query.mockResolvedValueOnce(items);
      await expect(service.catalog()).resolves.toEqual(items);
    });
  });

  describe('received', () => {
    it('maps rows with a nested sender and marks unseen as seen', async () => {
      query.mockResolvedValueOnce([
        {
          id: 'r1', giftId: 'g1', emoji: '🎁', label: 'Box',
          message: 'yo', seenAt: null, createdAt: '2026-06-10T00:00:00Z',
          senderId: 's1', senderName: 'Sam', senderAvatar: null,
        },
      ]);

      const out = await service.received('me');

      expect(out[0]).toEqual(
        expect.objectContaining({
          id: 'r1',
          giftId: 'g1',
          sender: { id: 's1', displayName: 'Sam', avatarUrl: null },
        }),
      );
      // mark-seen UPDATE fired (fire-and-forget).
      expect(query).toHaveBeenCalledTimes(2);
      expect(query.mock.calls[1]![0]).toContain('seen_at = NOW()');
    });
  });
});
