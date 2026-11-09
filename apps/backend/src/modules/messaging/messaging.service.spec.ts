// apps/backend/src/modules/messaging/messaging.service.spec.ts
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

import { MessagingService } from './messaging.service';

const VIEWER = '11111111-1111-1111-1111-111111111111';
const TARGET = '22222222-2222-2222-2222-222222222222';

describe('MessagingService', () => {
  let service: MessagingService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    const dsMock = { query } as unknown as DataSource;
    const mod = await Test.createTestingModule({
      providers: [
        MessagingService,
        { provide: getDataSourceToken(), useValue: dsMock },
      ],
    }).compile();
    service = mod.get(MessagingService);
  });

  // permissionFor: query #1 = block check, #2 = shared interests, #3 = existing conversation.
  const mockPermission = (shared: string[], convo: unknown[] = []): void => {
    query
      .mockResolvedValueOnce([{ exists: false }]) // isBlocked → not blocked
      .mockResolvedValueOnce([{ shared }])
      .mockResolvedValueOnce(convo);
  };

  it('grants chat when an accepted conversation (match) exists', async () => {
    mockPermission([], [{ id: 'c1', status: 'accepted', initiated_by: null }]);
    const res = await service.permissionFor(VIEWER, TARGET);
    expect(res.canMessage).toBe('chat');
    expect(res.matched).toBe(true);
  });

  it('does not reopen a legacy Dating match through the ordinary profile message CTA', async () => {
    const previous = process.env.NEXUS_DATING_RELEASE_ENABLED;
    delete process.env.NEXUS_DATING_RELEASE_ENABLED;
    try {
      mockPermission(['music'], [{
        id: 'c1', status: 'accepted', initiated_by: null, dating_match: true,
      }]);
      await expect(service.permissionFor(VIEWER, TARGET)).resolves.toMatchObject({
        canMessage: 'none', matched: false, conversation: null,
      });
      expect(query).toHaveBeenCalledTimes(3);
    } finally {
      if (previous === undefined) delete process.env.NEXUS_DATING_RELEASE_ENABLED;
      else process.env.NEXUS_DATING_RELEASE_ENABLED = previous;
    }
  });

  it('grants request on a shared interest with no conversation', async () => {
    mockPermission(['climbing'], []);
    const res = await service.permissionFor(VIEWER, TARGET);
    expect(res.canMessage).toBe('request');
    expect(res.matched).toBe(false);
    expect(res.sharedInterests).toEqual(['climbing']);
  });

  it('grants nothing without a match or shared interest', async () => {
    mockPermission([], []);
    const res = await service.permissionFor(VIEWER, TARGET);
    expect(res.canMessage).toBe('none');
  });

  it('returns none when either side has blocked, without checking interests', async () => {
    query.mockResolvedValueOnce([{ exists: true }]); // isBlocked → blocked
    const res = await service.permissionFor(VIEWER, TARGET);
    expect(res.canMessage).toBe('none');
    expect(res.matched).toBe(false);
    expect(query).toHaveBeenCalledTimes(1); // short-circuits before the interest/convo queries
  });

  it('caps the sender of an unanswered request to "request"', async () => {
    mockPermission(['music'], [{ id: 'c1', status: 'pending', initiated_by: VIEWER }]);
    const res = await service.permissionFor(VIEWER, TARGET);
    expect(res.canMessage).toBe('request');
  });

  it('lets the recipient of a pending request reply (chat)', async () => {
    mockPermission(['music'], [{ id: 'c1', status: 'pending', initiated_by: TARGET }]);
    const res = await service.permissionFor(VIEWER, TARGET);
    expect(res.canMessage).toBe('chat');
  });

  it('openForMessaging rejects a locked pair with chat.locked', async () => {
    mockPermission([], []);
    await expect(service.openForMessaging(VIEWER, TARGET)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('openForMessaging refuses messaging yourself', async () => {
    await expect(service.openForMessaging(VIEWER, VIEWER)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('openForMessaging mints a pending conversation for a fresh request', async () => {
    mockPermission(['surfing'], []); // permissionFor → request, no convo
    query.mockResolvedValueOnce([{ id: 'new-c', status: 'pending', initiated_by: VIEWER }]); // INSERT
    const res = await service.openForMessaging(VIEWER, TARGET);
    expect(res).toEqual({ conversationId: 'new-c', status: 'pending', permission: 'request' });
  });

  it('openForMessaging returns the existing accepted conversation for a match', async () => {
    mockPermission([], [{ id: 'c1', status: 'accepted', initiated_by: null }]);
    const res = await service.openForMessaging(VIEWER, TARGET);
    expect(res).toEqual({ conversationId: 'c1', status: 'accepted', permission: 'chat' });
  });
});
