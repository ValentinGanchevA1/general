import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { PresenceService } from '../presence/presence.service';
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
        {
          provide: PresenceService,
          useValue: { whichAreOnline: jest.fn().mockResolvedValue(new Set()) },
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
        .mockResolvedValueOnce(MSG) // INSERT
        .mockResolvedValueOnce([]) // UPDATE status → accepted
        .mockResolvedValueOnce([]); // UPDATE last_message_at

      await service.persist('c1', 'me', 'reply');
      const statusSql = txQuery.mock.calls.find((c) => String(c[0]).includes("status = 'accepted'"));
      expect(statusSql).toBeTruthy();
    });

    it('inserts and bumps last_message_at on an accepted conversation', async () => {
      txQuery
        .mockResolvedValueOnce([
          { participant_ids: ['me', 'other'], status: 'accepted', initiated_by: null },
        ])
        .mockResolvedValueOnce(MSG)
        .mockResolvedValueOnce([]);

      const res = await service.persist('c1', 'me', 'hi');
      expect(res.body).toBe('hi');
    });
  });

  describe('findMessages — gate + cursor pagination', () => {
    it('forbids a non-participant', async () => {
      query.mockResolvedValueOnce([]); // isParticipant → false
      await expect(service.findMessages('c1', 'me')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('returns a page and a nextCursor when more remain', async () => {
      query
        .mockResolvedValueOnce([{ exists: true }]) // isParticipant
        .mockResolvedValueOnce([
          {
            id: 'm2',
            conversationId: 'c1',
            senderId: 'me',
            body: 'b',
            type: 'text',
            location: null,
            locationSessionId: null,
            createdAt: new Date('2026-06-10T01:00:00Z'),
          },
          {
            id: 'm1',
            conversationId: 'c1',
            senderId: 'me',
            body: 'a',
            type: 'text',
            location: null,
            locationSessionId: null,
            createdAt: new Date('2026-06-10T00:00:00Z'),
          },
        ]);

      const page = await service.findMessages('c1', 'me', undefined, 2);
      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBe('2026-06-10T00:00:00.000Z');
    });

    it('returns nextCursor=null on the last page', async () => {
      query
        .mockResolvedValueOnce([{ exists: true }])
        .mockResolvedValueOnce([
          {
            id: 'm1',
            conversationId: 'c1',
            senderId: 'me',
            body: 'a',
            type: 'text',
            location: null,
            locationSessionId: null,
            createdAt: new Date('2026-06-10T00:00:00Z'),
          },
        ]);

      const page = await service.findMessages('c1', 'me', undefined, 30);
      expect(page.nextCursor).toBeNull();
    });

    it('applies the cursor predicate and binds it', async () => {
      query.mockResolvedValueOnce([{ exists: true }]).mockResolvedValueOnce([]);
      await service.findMessages('c1', 'me', '2026-06-01T00:00:00.000Z');
      const [, params] = query.mock.calls[1]!;
      expect(params).toContain('2026-06-01T00:00:00.000Z');
    });
  });

  describe('findConversations', () => {
    it('maps rows and nulls lastMessage when there are no messages', async () => {
      query.mockResolvedValueOnce([
        {
          id: 'c1',
          participantIds: ['me', 'other'],
          otherUserId: 'other',
          otherDisplayName: 'Other',
          otherAvatarUrl: null,
          otherVerification: 'none',
          status: 'accepted',
          initiatedBy: null,
          lastMessageAt: null,
          lastBody: null,
          lastSenderId: null,
          isFriend: false,
        },
      ]);

      const list = await service.findConversations('me');
      expect(list[0]!.lastMessage).toBeNull();
      expect(list[0]!.otherUser.displayName).toBe('Other');
    });

    it('builds lastMessage from the latest body/sender', async () => {
      query.mockResolvedValueOnce([
        {
          id: 'c1',
          participantIds: ['me', 'other'],
          otherUserId: 'other',
          otherDisplayName: 'Other',
          otherAvatarUrl: null,
          otherVerification: 'email',
          status: 'accepted',
          initiatedBy: null,
          lastMessageAt: new Date('2026-06-10T00:00:00Z'),
          lastBody: 'yo',
          lastSenderId: 'other',
          isFriend: true,
        },
      ]);

      const list = await service.findConversations('me');
      expect(list[0]!.lastMessage?.body).toBe('yo');
      expect(list[0]!.isFriend).toBe(true);
    });
  });

  describe('membership helpers', () => {
    it('isParticipant reflects the row presence', async () => {
      query.mockResolvedValueOnce([{ exists: true }]);
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
