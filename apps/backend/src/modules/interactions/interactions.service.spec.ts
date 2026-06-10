import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

import { InteractionsService } from './interactions.service';
import { RealtimeGateway } from '../../realtime/realtime.gateway';
import { NotificationsService } from '../notifications/notifications.service';
import { GamificationService } from '../gamification/gamification.service';
import { ChallengesService } from '../challenges/challenges.service';
import { AchievementsService } from '../achievements/achievements.service';

describe('InteractionsService', () => {
  let service: InteractionsService;
  let query: jest.Mock; // db.query — sender lookup (outside tx)
  let txQuery: jest.Mock; // tx.query — everything inside the transaction
  let emitWaveReceived: jest.Mock;
  let emitConversationOpened: jest.Mock;
  let notifyWave: jest.Mock;
  let award: jest.Mock;
  let increment: jest.Mock;
  let evaluate: jest.Mock;

  const SENDER = { display_name: 'Me', avatar_url: null, verification_level: 'email' };

  beforeEach(async () => {
    // Sender lookup succeeds by default (overridden in the sender-missing test).
    query = jest.fn().mockResolvedValue([SENDER]);
    txQuery = jest.fn().mockResolvedValue([]);
    const transaction = jest.fn(async (cb: (tx: { query: jest.Mock }) => unknown) =>
      cb({ query: txQuery }),
    );

    emitWaveReceived = jest.fn().mockResolvedValue(undefined);
    emitConversationOpened = jest.fn().mockResolvedValue(undefined);
    notifyWave = jest.fn().mockResolvedValue(undefined);
    award = jest.fn().mockResolvedValue(undefined);
    increment = jest.fn().mockResolvedValue(undefined);
    evaluate = jest.fn().mockResolvedValue(undefined);

    const mod = await Test.createTestingModule({
      providers: [
        InteractionsService,
        {
          provide: getDataSourceToken(),
          useValue: { query, transaction } as unknown as DataSource,
        },
        { provide: RealtimeGateway, useValue: { emitWaveReceived, emitConversationOpened } },
        { provide: NotificationsService, useValue: { notifyWave } },
        { provide: GamificationService, useValue: { award } },
        { provide: ChallengesService, useValue: { increment } },
        { provide: AchievementsService, useValue: { evaluate } },
      ],
    }).compile();
    service = mod.get(InteractionsService);
  });

  const INSERTED_WAVE = [{ id: 'w1', created_at: new Date('2026-06-10T00:00:00Z') }];

  describe('guards', () => {
    it('rejects waving at yourself before any DB work', async () => {
      await expect(service.wave('me', { toUserId: 'me' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(query).not.toHaveBeenCalled();
    });

    it('throws NotFound when the sender no longer exists', async () => {
      query.mockResolvedValueOnce([]); // sender lookup empty
      await expect(service.wave('me', { toUserId: 'target' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('fails the wave when the target does not exist', async () => {
      txQuery.mockResolvedValueOnce([]); // target lookup empty
      await expect(service.wave('me', { toUserId: 'ghost' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('enforces the 24h re-wave cooldown', async () => {
      txQuery
        .mockResolvedValueOnce([{ id: 'target' }]) // target exists
        .mockResolvedValueOnce([{ x: 1 }]); // a recent wave exists

      await expect(service.wave('me', { toUserId: 'target' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      // cooldown query is parameterized with the 24h window
      expect(txQuery.mock.calls[1]![1]).toEqual(['me', 'target', 24]);
    });
  });

  describe('one-way wave (no reciprocal)', () => {
    beforeEach(() => {
      txQuery
        .mockResolvedValueOnce([{ id: 'target' }]) // target
        .mockResolvedValueOnce([]) // cooldown: none
        .mockResolvedValueOnce([]) // reciprocal: none
        .mockResolvedValueOnce(INSERTED_WAVE); // insert wave
    });

    it('inserts the wave, emits to the recipient and counts the quest — no match', async () => {
      const res = await service.wave('me', { toUserId: 'target' });

      expect(res).toEqual({
        id: 'w1',
        fromUserId: 'me',
        toUserId: 'target',
        createdAt: '2026-06-10T00:00:00.000Z',
        conversationId: null,
      });

      expect(emitWaveReceived).toHaveBeenCalledWith(
        'target',
        expect.objectContaining({
          waveId: 'w1',
          fromUser: expect.objectContaining({ id: 'me', displayName: 'Me' }),
        }),
      );
      expect(notifyWave).toHaveBeenCalled();
      expect(increment).toHaveBeenCalledWith('me', 'wave_sent');

      // No match → no conversation, no reciprocal rewards.
      expect(emitConversationOpened).not.toHaveBeenCalled();
      expect(award).not.toHaveBeenCalled();
    });
  });

  describe('reciprocal wave → match', () => {
    it('opens a new conversation, links the prior wave and rewards both sides', async () => {
      txQuery
        .mockResolvedValueOnce([{ id: 'target' }]) // target
        .mockResolvedValueOnce([]) // cooldown: none
        .mockResolvedValueOnce([{ id: 'w0' }]) // reciprocal outstanding wave
        .mockResolvedValueOnce([]) // openConversation: no existing convo
        .mockResolvedValueOnce([{ id: 'conv1' }]) // INSERT conversation RETURNING
        .mockResolvedValueOnce([]) // UPDATE the reciprocal wave with conversation_id
        .mockResolvedValueOnce(INSERTED_WAVE); // INSERT new wave

      const res = await service.wave('me', { toUserId: 'target' });

      expect(res.conversationId).toBe('conv1');
      expect(emitConversationOpened).toHaveBeenCalledWith('conv1', ['me', 'target'], 'w1');

      // Both participants rewarded once per match (idempotent dedupeKey).
      expect(award).toHaveBeenCalledTimes(2);
      expect(award).toHaveBeenCalledWith('me', 'wave.reciprocated', { dedupeKey: 'match:conv1' });
      expect(award).toHaveBeenCalledWith('target', 'wave.reciprocated', { dedupeKey: 'match:conv1' });
      expect(increment).toHaveBeenCalledWith('me', 'match_made');
      expect(increment).toHaveBeenCalledWith('target', 'match_made');
      expect(evaluate).toHaveBeenCalledTimes(2);

      // Linked the outstanding reciprocal wave to the conversation.
      const updateCall = txQuery.mock.calls[5]!;
      expect(updateCall[0]).toContain('UPDATE waves SET conversation_id');
      expect(updateCall[1]).toEqual(['conv1', 'w0']);
    });

    it('reuses and accepts an existing conversation instead of inserting one', async () => {
      txQuery
        .mockResolvedValueOnce([{ id: 'target' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'w0' }]) // reciprocal
        .mockResolvedValueOnce([{ id: 'conv-existing' }]) // openConversation finds one
        .mockResolvedValueOnce([]) // UPDATE conversations SET status accepted
        .mockResolvedValueOnce([]) // UPDATE reciprocal wave
        .mockResolvedValueOnce(INSERTED_WAVE);

      const res = await service.wave('me', { toUserId: 'target' });

      expect(res.conversationId).toBe('conv-existing');
      const acceptCall = txQuery.mock.calls[4]!;
      expect(acceptCall[0]).toContain("status = 'accepted'");
      // No INSERT conversations call was made.
      const insertedConvo = txQuery.mock.calls.some((c) =>
        String(c[0]).includes('INSERT INTO conversations'),
      );
      expect(insertedConvo).toBe(false);
    });
  });
});
