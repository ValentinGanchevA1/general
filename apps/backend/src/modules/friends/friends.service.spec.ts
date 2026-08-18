import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import { BlocksService } from '../blocks/blocks.service';
import { PresenceService } from '../presence/presence.service';
import { FriendsNotifyService } from './friends-notify.service';
import { FriendsService } from './friends.service';

describe('FriendsService', () => {
  let service: FriendsService;
  let query: jest.Mock;
  let isBlocked: jest.Mock;
  let whichAreOnline: jest.Mock;
  let onRequestCreated: jest.Mock;
  let onRequestAccepted: jest.Mock;
  let countPending: jest.Mock;

  const A = '11111111-1111-1111-1111-111111111111';
  const B = '22222222-2222-2222-2222-222222222222';

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    isBlocked = jest.fn().mockResolvedValue(false);
    whichAreOnline = jest.fn().mockResolvedValue(new Set());
    onRequestCreated = jest.fn().mockResolvedValue(undefined);
    onRequestAccepted = jest.fn().mockResolvedValue(undefined);
    countPending = jest.fn().mockResolvedValue(3);

    const mod = await Test.createTestingModule({
      providers: [
        FriendsService,
        {
          provide: getDataSourceToken(),
          useValue: { query, transaction: jest.fn() } as unknown as DataSource,
        },
        { provide: BlocksService, useValue: { isBlocked } },
        { provide: PresenceService, useValue: { whichAreOnline } },
        {
          provide: FriendsNotifyService,
          useValue: { onRequestCreated, onRequestAccepted, countPending },
        },
      ],
    }).compile();
    service = mod.get(FriendsService);
  });

  describe('follow', () => {
    it('rejects self-follow', async () => {
      await expect(service.follow(A, A)).rejects.toBeInstanceOf(BadRequestException);
      expect(query).not.toHaveBeenCalled();
    });

    it('rejects when blocked', async () => {
      isBlocked.mockResolvedValueOnce(true);
      await expect(service.follow(A, B)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('inserts follow edge when target exists', async () => {
      query
        .mockResolvedValueOnce([{ id: B }]) // assertUserExists
        .mockResolvedValueOnce([]); // INSERT
      await expect(service.follow(A, B)).resolves.toEqual({ following: true });
      expect(query.mock.calls[1]![0]).toContain('INSERT INTO follows');
    });
  });

  describe('requestFriend', () => {
    it('rejects self-request', async () => {
      await expect(service.requestFriend(A, A)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when already friends', async () => {
      query
        .mockResolvedValueOnce([{ id: B }]) // assertUserExists
        .mockResolvedValueOnce([{ exists: true }]); // friendship EXISTS
      await expect(service.requestFriend(A, B)).rejects.toBeInstanceOf(ConflictException);
      expect(onRequestCreated).not.toHaveBeenCalled();
    });

    it('inserts pending request and fires notify', async () => {
      const requestId = '33333333-3333-3333-3333-333333333333';
      query
        .mockResolvedValueOnce([{ id: B }]) // assertUserExists
        .mockResolvedValueOnce([{ exists: false }]) // not friends
        .mockResolvedValueOnce([]) // no inbound
        .mockResolvedValueOnce([{ id: requestId }]); // INSERT RETURNING
      await expect(service.requestFriend(A, B)).resolves.toEqual({ requestId });
      expect(onRequestCreated).toHaveBeenCalledWith(A, B, requestId);
    });
  });

  describe('unfriend', () => {
    it('deletes friendship only (keeps follows)', async () => {
      await expect(service.unfriend(A, B)).resolves.toEqual({ friends: false });
      const [sql] = query.mock.calls[0]!;
      expect(sql).toContain('DELETE FROM friendships');
      expect(sql).not.toContain('DELETE FROM follows');
    });
  });

  describe('countPendingIncoming', () => {
    it('delegates to FriendsNotifyService.countPending', async () => {
      await expect(service.countPendingIncoming(A)).resolves.toEqual({ count: 3 });
      expect(countPending).toHaveBeenCalledWith(A);
    });
  });

  describe('relationship', () => {
    it('returns none for self', async () => {
      await expect(service.relationship(A, A)).resolves.toEqual({
        state: 'none',
        mutualFriendsCount: 0,
        isFollowing: false,
        isFollowedBy: false,
      });
    });
  });
});
