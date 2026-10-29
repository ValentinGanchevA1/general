import type { DataSource } from 'typeorm';

import type { ChatService } from './chat.service';
import { LocationShareService } from './location-share.service';

const conversationId = 'conversation-1';
const sharerId = 'user-a';
const peerId = 'user-b';
const sessionId = 'session-1';

function activeSessionRow(): Record<string, unknown> {
  return {
    id: sessionId,
    conversation_id: conversationId,
    sharer_id: sharerId,
    status: 'active',
    duration: '15m',
    started_at: new Date(Date.now() - 60_000).toISOString(),
    ends_at: null,
    last_lat: 43.21,
    last_lng: 27.93,
    last_updated_at: new Date(
      Date.now() - LocationShareService.MIN_UPDATE_INTERVAL_MS - 1_000,
    ).toISOString(),
    ended_at: null,
    end_reason: null,
  };
}

function makeHarness(options: { participant?: boolean; blocked?: boolean } = {}): {
  service: LocationShareService;
  query: jest.Mock;
  isDmParticipant: jest.Mock;
  getParticipantIds: jest.Mock;
} {
  const participant = options.participant ?? true;
  const blocked = options.blocked ?? false;
  const query = jest.fn();
  const isDmParticipant = jest.fn(async () => participant);
  const getParticipantIds = jest.fn(async () => [sharerId, peerId]);

  const db = { query } as unknown as DataSource;
  const chat = { isDmParticipant, getParticipantIds } as unknown as ChatService;
  const service = new LocationShareService(db, chat);

  query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT * FROM chat_location_sessions WHERE id = $1')) {
      return [activeSessionRow()];
    }
    if (sql.includes('SELECT EXISTS')) {
      return [{ exists: blocked }];
    }
    if (sql.includes('UPDATE chat_location_sessions')) {
      return [];
    }
    if (sql.includes('SELECT * FROM chat_location_sessions')) {
      return [activeSessionRow()];
    }
    throw new Error(`Unexpected query: ${sql}`);
  });

  return { service, query, isDmParticipant, getParticipantIds };
}

describe('LocationShareService dynamic privacy authorization', () => {
  it('rejects a precise update when the relationship becomes blocked', async () => {
    const { service, query } = makeHarness({ blocked: true });

    await expect(
      service.update(sharerId, sessionId, { lat: 43.22, lng: 27.94 }),
    ).rejects.toMatchObject({
      response: {
        code: 'location.blocked',
      },
    });

    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls[1]?.[0]).toContain('SELECT EXISTS');
  });

  it('rejects a precise update when the sharer is no longer an eligible DM participant', async () => {
    const { service, query, getParticipantIds } = makeHarness({ participant: false });

    await expect(
      service.update(sharerId, sessionId, { lat: 43.22, lng: 27.94 }),
    ).rejects.toMatchObject({
      response: {
        code: 'location.not_participant',
      },
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(getParticipantIds).not.toHaveBeenCalled();
  });

  it('does not return the last precise point after either participant blocks the other', async () => {
    const { service, query } = makeHarness({ blocked: true });

    await expect(service.findActiveForConversation(conversationId, peerId)).rejects.toMatchObject({
      response: {
        code: 'location.blocked',
      },
    });

    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain('SELECT EXISTS');
  });

  it('continues to accept updates for an authorized active DM session', async () => {
    const { service, query, isDmParticipant, getParticipantIds } = makeHarness();

    const result = await service.update(sharerId, sessionId, { lat: 43.22, lng: 27.94 });

    expect(result.conversationId).toBe(conversationId);
    expect(isDmParticipant).toHaveBeenCalledWith(conversationId, sharerId);
    expect(getParticipantIds).toHaveBeenCalledWith(conversationId);
    expect(query).toHaveBeenCalledTimes(3);
    expect(query.mock.calls[2]?.[0]).toContain('UPDATE chat_location_sessions');
  });
});
