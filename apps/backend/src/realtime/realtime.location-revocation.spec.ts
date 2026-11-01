import { RealtimeGateway } from './realtime.gateway';

const conversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const sharerId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const peerId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const location = { lat: 43.21357, lng: 27.93461 };

interface Delivered {
  event: string;
  payload: unknown;
}

describe('RealtimeGateway live location multi-socket revocation', () => {
  it('rejects conversation rejoin after a block or participant removal', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const join = jest.fn();
    const client = { data: { userId: peerId, rooms: new Set<string>() }, join };
    const getRecipientIds = jest.fn().mockResolvedValue([sharerId]);
    Object.assign(gateway, {
      chatRealtimeAccess: { getRecipientIds },
      logger: { error: jest.fn() },
    });

    await expect(gateway.onConversationJoin(client as never, { conversationId }))
      .resolves.toMatchObject({ ok: false, code: 'chat.forbidden' });
    expect(join).not.toHaveBeenCalled();
    expect(client.data.rooms.size).toBe(0);
    expect(getRecipientIds).toHaveBeenCalledWith(conversationId, false);

    getRecipientIds.mockResolvedValue([]);
    await expect(gateway.onConversationJoin(client as never, { conversationId }))
      .resolves.toMatchObject({ ok: false, code: 'chat.forbidden' });
    expect(join).not.toHaveBeenCalled();
  });

  it('does not deliver precise updates to blocked peer sockets retaining stale conversation rooms', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const received = new Map<string, Delivered[]>();
    const sockets = [
      { id: 'sender-phone', rooms: new Set([`user:${sharerId}`, `convo:${conversationId}`]) },
      { id: 'peer-phone', rooms: new Set([`user:${peerId}`, `convo:${conversationId}`]) },
      { id: 'peer-tablet', rooms: new Set([`user:${peerId}`, `convo:${conversationId}`]) },
    ];
    for (const socket of sockets) received.set(socket.id, []);

    const getRecipientIds = jest.fn().mockResolvedValue([sharerId]);
    const update = jest.fn().mockResolvedValue({
      conversationId,
      updatedAt: '2026-10-28T10:00:00.000Z',
    });
    const to = jest.fn((room: string) => ({
      emit: (event: string, payload: unknown) => {
        for (const socket of sockets) {
          if (socket.rooms.has(room)) received.get(socket.id)!.push({ event, payload });
        }
      },
    }));
    Object.assign(gateway, {
      chatRealtimeAccess: { getRecipientIds },
      locationShare: { update },
      server: { to },
      logger: { error: jest.fn() },
    });

    const result = await gateway.onLocationShareUpdate(
      { data: { userId: sharerId } } as never,
      { sessionId: 'session-1', location },
    );
    expect(result).toEqual({ ok: true, data: { updatedAt: '2026-10-28T10:00:00.000Z' } });
    expect(getRecipientIds).toHaveBeenCalledWith(conversationId, true);
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith(`user:${sharerId}`);
    expect(received.get('sender-phone')).toEqual([
      { event: 'location:share:update', payload: expect.objectContaining({ location }) },
    ]);
    expect(received.get('peer-phone')).toEqual([]);
    expect(received.get('peer-tablet')).toEqual([]);
  });

  it('emits no precise location when all recipients lose conversation access', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const to = jest.fn().mockReturnValue({ emit: jest.fn() });
    const getRecipientIds = jest.fn().mockResolvedValue([]);
    Object.assign(gateway, {
      chatRealtimeAccess: { getRecipientIds },
      locationShare: { update: jest.fn().mockResolvedValue({ conversationId, updatedAt: 'now' }) },
      server: { to },
      logger: { error: jest.fn() },
    });
    await expect(gateway.onLocationShareUpdate(
      { data: { userId: sharerId } } as never,
      { sessionId: 'session-1', location },
    )).resolves.toMatchObject({ ok: true });
    expect(getRecipientIds).toHaveBeenCalledWith(conversationId, true);
    expect(to).not.toHaveBeenCalled();
  });

  it('fails closed without emitting GPS if recipient authorization fails', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const to = jest.fn().mockReturnValue({ emit: jest.fn() });
    const getRecipientIds = jest.fn().mockRejectedValue(new Error('authorization database unavailable'));
    Object.assign(gateway, {
      chatRealtimeAccess: { getRecipientIds },
      locationShare: { update: jest.fn().mockResolvedValue({ conversationId, updatedAt: 'now' }) },
      server: { to },
      logger: { error: jest.fn() },
    });
    await expect(gateway.onLocationShareUpdate(
      { data: { userId: sharerId } } as never,
      { sessionId: 'session-1', location },
    )).resolves.toMatchObject({ ok: false });
    expect(getRecipientIds).toHaveBeenCalledWith(conversationId, true);
    expect(to).not.toHaveBeenCalled();
  });

  it('does not leak ended-session metadata to a revoked peer via stale rooms', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const to = jest.fn().mockReturnValue({ emit: jest.fn() });
    const getRecipientIds = jest.fn().mockResolvedValue([sharerId]);
    Object.assign(gateway, { chatRealtimeAccess: { getRecipientIds }, server: { to } });

    await gateway.emitLocationShareEnded(conversationId, 'session-1', 'blocked', 'now');
    expect(getRecipientIds).toHaveBeenCalledWith(conversationId, true);
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith(`user:${sharerId}`);
    expect(to).not.toHaveBeenCalledWith(`user:${peerId}`);
  });

  it('fails closed on ended-session recipient authorization failure', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const to = jest.fn().mockReturnValue({ emit: jest.fn() });
    const getRecipientIds = jest.fn().mockRejectedValue(new Error('database unavailable'));
    Object.assign(gateway, {
      chatRealtimeAccess: { getRecipientIds },
      server: { to },
    });
    await expect(gateway.emitLocationShareEnded(conversationId, 'session-1', 'expired', 'now'))
      .rejects.toThrow('database unavailable');
    expect(getRecipientIds).toHaveBeenCalledWith(conversationId, true);
    expect(to).not.toHaveBeenCalled();
  });

  it('delivers to both devices of an authorized peer without using conversation rooms', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const to = jest.fn().mockReturnValue({ emit: jest.fn() });
    const getRecipientIds = jest.fn().mockResolvedValue([sharerId, peerId]);
    Object.assign(gateway, {
      chatRealtimeAccess: { getRecipientIds },
      locationShare: { update: jest.fn().mockResolvedValue({ conversationId, updatedAt: 'now' }) },
      server: { to },
      logger: { error: jest.fn() },
    });
    await expect(gateway.onLocationShareUpdate(
      { data: { userId: sharerId } } as never,
      { sessionId: 'session-1', location },
    )).resolves.toMatchObject({ ok: true });
    expect(getRecipientIds).toHaveBeenCalledWith(conversationId, true);
    expect(to.mock.calls.map(([room]: [string]) => room)).toEqual([
      `user:${sharerId}`,
      `user:${peerId}`,
    ]);
  });
});