import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { ChatService } from './chat.service';

describe('ChatService', () => {
  let service: ChatService;
  let query: jest.Mock; // db.query (non-transactional reads)
  let txQuery: jest.Mock; // tx.query (inside persist's transaction)

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    txQuery = jest.fn().mockResolvedValue([]);
    const transaction = jest.fn(async (cb: (tx: { query: jest.Mock }) => unknown) =>
      cb({ query: txQuery }),
    );

    const mod = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: getDataSourceToken(),
          useValue: { query, transaction } as unknown as DataSource,
        },
      ],
    }).compile();
    service = mod.get(ChatService);
  });

  const MSG = [
    {
      id: 'm1',
      conversationId: 'c1',
      senderId: 'me',
      body: 'hi',
      createdAt: new Date('2026-06-10T00:00:00Z'),
    },
  ];

  describe('persist — gate + transaction', () => {
    it('throws NotFound when the conversation does not exist', async () => {
      txQuery.mockResolvedValueOnce([]); // SELECT ... FOR UPDATE
      await expect(service.persist('c1', 'me', 'hi')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids a non-participant', async () => {
      txQuery.mockResolvedValueOnce([
        { participant_ids: ['a', 'b'], status: 'accepted', initiated_by: null },
      ]);
      await expect(service.persist('c1', 'me', 'hi')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('caps the initiator at one message while the request is pending', async () => {
      txQuery
        .mockResolvedValueOnce([
          { participant_ids: ['me', 'other'], status: 'pending', initiated_by: 'me' },
        ])
        .mockResolvedValueOnce([{ count: 1 }]); // already sent a message

      await expect(service.persist('c1', 'me', 'again')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'chat.request_pending' }),
      });
    });

    it('allows the initiator the first request message', async () => {
      txQuery
        .mockResolvedValueOnce([
          { participant_ids: ['me', 'other'], status: 'pending', initiated_by: 'me' },
        ])
        .mockResolvedValueOnce([{ count: 0 }]) // no prior message
        .mockResolvedValueOnce(MSG) // INSERT
        .mockResolvedValueOnce([]); // UPDATE last_message_at

      const res = await service.persist('c1', 'me', 'hi');
      expect(res.id).toBe('m1');
      expect(res.createdAt).toBe('2026-06-10T00:00:00.000Z'); // Date -> ISO
    });

    it('promotes the conversation to accepted when the recipient replies', async () => {
      txQuery
        .mockResolvedValueOnce([
          { participant_ids: ['me', 'other'], status: 'pending', initiated_by: 'other' },
        ])
        .mockResolvedValueOnce([]) // UPDATE status accepted
        .mockResolvedValueOnce(MSG) // INSERT
        .mockResolvedValueOnce([]); // UPDATE last_message_at

      await service.persist('c1', 'me', 'sure');
      expect(txQuery.mock.calls[1]![0]).toContain("status = 'accepted'");
    });

    it('inserts and bumps last_message_at on an accepted conversation', async () => {
      txQuery
        .mockResolvedValueOnce([
          { participant_ids: ['me', 'other'], status: 'accepted', initiated_by: 'other' },
        ])
        .mockResolvedValueOnce(MSG) // INSERT (gate skipped)
        .mockResolvedValueOnce([]); // UPDATE last_message_at

      const res = await service.persist('c1', 'me', 'hello');
      expect(res).toMatchObject({ id: 'm1', senderId: 'me', body: 'hi' });
      expect(txQuery.mock.calls[2]![0]).toContain('last_message_at = NOW()');
    });
  });

  describe('findMessages — gate + cursor pagination', () => {
    const rows = [
      { id: 'm3', conversationId: 'c1', senderId: 'me', body: 'c', createdAt: new Date('2026-06-10T03:00:00Z') },
      { id: 'm2', conversationId: 'c1', senderId: 'x', body: 'b', createdAt: new Date('2026-06-10T02:00:00Z') },
      { id: 'm1', conversationId: 'c1', senderId: 'me', body: 'a', createdAt: new Date('2026-06-10T01:00:00Z') },
    ];

    it('forbids a non-participant', async () => {
      query.mockResolvedValueOnce([]); // isParticipant -> not a member
      await expect(service.findMessages('c1', 'me')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns a page and a nextCursor when more remain', async () => {
      query
        .mockResolvedValueOnce([{ x: 1 }]) // isParticipant -> true
        .mockResolvedValueOnce(rows); // 3 rows for cap=2 -> hasMore

      const res = await service.findMessages('c1', 'me', undefined, 2);

      expect(res.messages).toHaveLength(2);
      expect(res.nextCursor).toBe('2026-06-10T02:00:00.000Z'); // oldest of the page
      expect(query.mock.calls[1]![1]).toEqual(['c1', 3]); // cap + 1 fetched
    });

    it('returns nextCursor=null on the last page', async () => {
      query
        .mockResolvedValueOnce([{ x: 1 }])
        .mockResolvedValueOnce(rows.slice(0, 2)); // exactly cap

      const res = await service.findMessages('c1', 'me', undefined, 2);
      expect(res.messages).toHaveLength(2);
      expect(res.nextCursor).toBeNull();
    });

    it('applies the cursor predicate and binds it', async () => {
      query.mockResolvedValueOnce([{ x: 1 }]).mockResolvedValueOnce([]);
      await service.findMessages('c1', 'me', '2026-06-10T02:00:00.000Z', 2);

      const [sql, params] = query.mock.calls[1]!;
      expect(sql).toContain('created_at < $3');
      expect(params).toEqual(['c1', 3, '2026-06-10T02:00:00.000Z']);
    });
  });

  describe('findConversations', () => {
    it('maps rows and nulls lastMessage when there are no messages', async () => {
      query.mockResolvedValueOnce([
        {
          id: 'c1',
          participant_ids: ['me', 'other'],
          status: 'accepted',
          initiated_by: 'me',
          last_message_at: null,
          last_body: null,
          last_sender_id: null,
          participants: [{ id: 'me', displayName: 'Me', avatarUrl: null }],
        },
      ]);

      const [c] = await service.findConversations('me');
      expect(c).toMatchObject({
        id: 'c1',
        participantIds: ['me', 'other'],
        lastMessage: null,
        status: 'accepted',
      });
    });

    it('builds lastMessage from the latest body/sender', async () => {
      query.mockResolvedValueOnce([
        {
          id: 'c1', participant_ids: ['me', 'other'], status: 'accepted', initiated_by: 'me',
          last_message_at: '2026-06-10T00:00:00Z', last_body: 'yo', last_sender_id: 'other',
          participants: [],
        },
      ]);
      const [c] = await service.findConversations('me');
      expect(c!.lastMessage).toEqual({ senderId: 'other', body: 'yo' });
    });
  });

  describe('membership helpers', () => {
    it('isParticipant reflects the row presence', async () => {
      query.mockResolvedValueOnce([{ x: 1 }]);
      await expect(service.isParticipant('c1', 'me')).resolves.toBe(true);
      query.mockResolvedValueOnce([]);
      await expect(service.isParticipant('c1', 'me')).resolves.toBe(false);
    });

    it('getParticipantIds returns the array or [] when missing', async () => {
      query.mockResolvedValueOnce([{ participant_ids: ['a', 'b'] }]);
      await expect(service.getParticipantIds('c1')).resolves.toEqual(['a', 'b']);
      query.mockResolvedValueOnce([]);
      await expect(service.getParticipantIds('c1')).resolves.toEqual([]);
    });
  });
});
