import { ForbiddenException } from '@nestjs/common';
import type { DataSource } from 'typeorm';

import type { ChatService } from './chat.service';
import { LocationShareService } from './location-share.service';

describe('LocationShareService live update authorization', () => {
  const session = {
    id: 'session-a',
    conversation_id: 'conversation-a',
    sharer_id: 'user-a',
    status: 'active',
    last_updated_at: '2020-01-01T00:00:00.000Z',
  };

  const setup = (member: boolean, blocked: boolean) => {
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql.includes('SELECT * FROM chat_location_sessions')) return Promise.resolve([session]);
      if (sql.includes('SELECT EXISTS')) return Promise.resolve([{ exists: blocked }]);
      return Promise.resolve([]);
    });
    const chat = {
      isParticipant: jest.fn().mockResolvedValue(member),
      getParticipantIds: jest.fn().mockResolvedValue(['user-a', 'user-b']),
    } as unknown as ChatService;
    const service = new LocationShareService({ query } as unknown as DataSource, chat);
    return { service, query };
  };

  it('rejects updates when the sharer is no longer a conversation participant', async () => {
    const { service, query } = setup(false, false);
    await expect(service.update('user-a', 'session-a', { lat: 43.2, lng: 27.9 }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(query.mock.calls.some(([sql]: [string]) => sql.includes('UPDATE chat_location_sessions'))).toBe(false);
  });

  it('rejects updates after either conversation participant blocks the other', async () => {
    const { service, query } = setup(true, true);
    await expect(service.update('user-a', 'session-a', { lat: 43.2, lng: 27.9 }))
      .rejects.toMatchObject({ response: { code: 'location.blocked' } });
    expect(query.mock.calls.some(([sql]: [string]) => sql.includes('UPDATE chat_location_sessions'))).toBe(false);
  });

  it('allows active sharer updates only while membership and block checks pass', async () => {
    const { service, query } = setup(true, false);
    await expect(service.update('user-a', 'session-a', { lat: 43.2, lng: 27.9 }))
      .resolves.toMatchObject({ conversationId: 'conversation-a' });
    expect(query.mock.calls.some(([sql]: [string]) => sql.includes('UPDATE chat_location_sessions'))).toBe(true);
  });
});
