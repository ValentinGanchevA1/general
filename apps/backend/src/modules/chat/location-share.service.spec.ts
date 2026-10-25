import { ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import type { DataSource } from 'typeorm';

import { ChatService } from './chat.service';
import { LocationShareService } from './location-share.service';

interface SessionRow {
  id: string;
  conversation_id: string;
  sharer_id: string;
  status: 'active' | 'ended';
  duration: '15m' | '60m' | 'until_off';
  started_at: Date;
  ends_at: Date | null;
  last_lat: number;
  last_lng: number;
  last_updated_at: Date;
  ended_at: Date | null;
  end_reason: string | null;
}

describe('LocationShareService', () => {
  let service: LocationShareService;
  let query: jest.Mock;
  let getParticipantIds: jest.Mock;
  let persistLocationSession: jest.Mock;

  const ACTIVE: SessionRow = {
    id: 'ls1',
    conversation_id: 'c1',
    sharer_id: 'me',
    status: 'active',
    duration: '15m',
    started_at: new Date(Date.now() - 60_000),
    ends_at: new Date(Date.now() + 14 * 60_000),
    last_lat: 42.7,
    last_lng: 23.3,
    last_updated_at: new Date(Date.now() - 10_000),
    ended_at: null,
    end_reason: null,
  };

  beforeEach(async () => {
    query = jest.fn().mockResolvedValue([]);
    getParticipantIds = jest.fn().mockResolvedValue(['me', 'other']);
    persistLocationSession = jest.fn();

    const mod = await Test.createTestingModule({
      providers: [
        LocationShareService,
        { provide: getDataSourceToken(), useValue: { query } as unknown as DataSource },
        {
          provide: ChatService,
          useValue: { getParticipantIds, persistLocationSession },
        },
      ],
    }).compile();

    service = mod.get(LocationShareService);
  });

  it('rejects start when either conversation participant has blocked the other', async () => {
    query.mockResolvedValueOnce([{ exists: true }]);

    await expect(
      service.start('me', 'c1', '15m', { lat: 42.7, lng: 23.3 }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'location.blocked' }) });

    expect(getParticipantIds).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(1);
    const [sql, params] = query.mock.calls[0]!;
    expect(String(sql)).toContain('user_blocks');
    expect(params).toEqual(['me', 'other']);
    expect(persistLocationSession).not.toHaveBeenCalled();
  });

  it('rejects an active-session update after a block before mutating coordinates', async () => {
    query
      .mockResolvedValueOnce([ACTIVE])
      .mockResolvedValueOnce([{ exists: true }]);

    await expect(
      service.update('me', 'ls1', { lat: 42.71, lng: 23.31 }),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'location.blocked' }) });

    expect(getParticipantIds).toHaveBeenCalledWith('c1');
    expect(query).toHaveBeenCalledTimes(2);
    expect(query.mock.calls.some((call) => String(call[0]).includes('SET last_lat'))).toBe(false);
  });

  it('does not expose an active location session through a blocked conversation', async () => {
    query.mockResolvedValueOnce([{ exists: true }]);

    await expect(
      service.findActiveForConversation('c1', 'me'),
    ).rejects.toMatchObject({ response: expect.objectContaining({ code: 'location.blocked' }) });

    expect(getParticipantIds).toHaveBeenCalledTimes(2);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls.some((call) => String(call[0]).includes('FROM chat_location_sessions'))).toBe(false);
  });

  it('keeps stop available as self-cleanup without a block check', async () => {
    query
      .mockResolvedValueOnce([ACTIVE])
      .mockResolvedValueOnce([]);

    const result = await service.stop('me', 'ls1');

    expect(result.conversationId).toBe('c1');
    expect(getParticipantIds).not.toHaveBeenCalled();
    expect(query).toHaveBeenCalledTimes(2);
    const [sql, params] = query.mock.calls[1]!;
    expect(String(sql)).toContain('end_reason = $3');
    expect(params[0]).toBe('ls1');
    expect(params[2]).toBe('stopped');
  });

  it('closes the session row when the chat message gate rejects after insert', async () => {
    const inserted: SessionRow = {
      ...ACTIVE,
      id: 'ls-new',
      started_at: new Date(),
      last_updated_at: new Date(),
    };
    const gateError = new ForbiddenException({
      code: 'chat.blocked',
      message: 'Conversation unavailable because one participant is blocked',
    });

    query
      .mockResolvedValueOnce([{ exists: false }]) // block check
      .mockResolvedValueOnce([]) // end previous active sessions
      .mockResolvedValueOnce([inserted]) // INSERT session
      .mockResolvedValueOnce([]); // markEnded after chat failure
    persistLocationSession.mockRejectedValueOnce(gateError);

    await expect(
      service.start('me', 'c1', '15m', { lat: 42.7, lng: 23.3 }),
    ).rejects.toBe(gateError);

    expect(persistLocationSession).toHaveBeenCalledWith(
      'c1',
      'me',
      'ls-new',
      'Started sharing live location for 15 minutes',
      { lat: 42.7, lng: 23.3 },
    );
    const cleanupCall = query.mock.calls.find((call) => {
      const params = call[1] as unknown[];
      return params?.[0] === 'ls-new' && params?.[2] === 'conversation_closed';
    });
    expect(cleanupCall).toBeDefined();
    expect(String(cleanupCall![0])).toContain("SET status = 'ended'");
  });
});
