import type { DataSource } from 'typeorm';

import type { PresenceService } from '../presence/presence.service';
import type { AnalyticsService } from '../analytics/analytics.service';
import { ChatService } from './chat.service';

describe('ChatService product analytics', () => {
  it('records chat.message_sent only after a durable text message succeeds', async () => {
    const txQuery = jest
      .fn()
      .mockResolvedValueOnce([
        { participant_ids: ['me', 'peer'], status: 'accepted', initiated_by: null },
      ])
      .mockResolvedValueOnce([
        {
          id: 'm1',
          conversationId: 'c1',
          senderId: 'me',
          body: 'private message body',
          type: 'text',
          location: null,
          locationSessionId: null,
          createdAt: new Date('2026-10-25T10:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const db = {
      transaction: jest.fn(async (cb: (tx: { query: typeof txQuery }) => Promise<unknown>) =>
        cb({ query: txQuery }),
      ),
    } as unknown as DataSource;
    const presence = { whichAreOnline: jest.fn() } as unknown as PresenceService;
    const analyticsRecord = jest.fn().mockResolvedValue(undefined);
    const analytics = { record: analyticsRecord } as unknown as AnalyticsService;
    const service = new ChatService(db, presence, analytics);

    const message = await service.persist('c1', 'me', 'private message body');

    expect(message.id).toBe('m1');
    expect(analyticsRecord).toHaveBeenCalledWith('me', 'chat.message_sent');
    expect(analyticsRecord.mock.calls[0]).toHaveLength(2);
  });

  it('does not record analytics when persistence fails before commit', async () => {
    const db = {
      transaction: jest.fn().mockRejectedValue(new Error('db failed')),
    } as unknown as DataSource;
    const presence = { whichAreOnline: jest.fn() } as unknown as PresenceService;
    const analyticsRecord = jest.fn().mockResolvedValue(undefined);
    const analytics = { record: analyticsRecord } as unknown as AnalyticsService;
    const service = new ChatService(db, presence, analytics);

    await expect(service.persist('c1', 'me', 'private message body')).rejects.toThrow('db failed');
    expect(analyticsRecord).not.toHaveBeenCalled();
  });
});
