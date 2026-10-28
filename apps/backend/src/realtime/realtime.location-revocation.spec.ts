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
  it('does not deliver precise updates to blocked peer sockets retaining stale conversation rooms', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const received = new Map<string, Delivered[]>();
    const sockets = [
      { id: 'sender-phone', rooms: new Set([`user:${sharerId}`, `convo:${conversationId}`]) },
      { id: 'peer-phone', rooms: new Set([`user:${peerId}`, `convo:${conversationId}`]) },
      { id: 'peer-tablet', rooms: new Set([`user:${peerId}`, `convo:${conversationId}`]) },
    ];
    for (const socket of sockets) received.set(socket.id, []);

    // Simulate the current SQL recipient result after the peer blocks the sharer.
    const query = jest.fn().mockResolvedValue([{ user_id: sharerId }]);
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
      db: { query },
      locationShare: { update },
      server: { to },
      logger: { error: jest.fn() },
    });

    const result = await gateway.onLocationShareUpdate(
      { data: { userId: sharerId } } as never,
      { sessionId: 'session-1', location },
    );
    expect(result).toEqual({ ok: true, data: { updatedAt: '2026-10-28T10:00:00.000Z' } });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('user_blocks'), [conversationId]);
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith(`user:${sharerId}`);
    expect(received.get('sender-phone')).toEqual([
      { event: 'location:share:update', payload: expect.objectContaining({ location }) },
    ]);
    expect(received.get('peer-phone')).toEqual([]);
    expect(received.get('peer-tablet')).toEqual([]);
  });

  it('delivers to both devices of an authorized peer without using conversation rooms', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const to = jest.fn().mockReturnValue({ emit: jest.fn() });
    Object.assign(gateway, {
      db: { query: jest.fn().mockResolvedValue([{ user_id: sharerId }, { user_id: peerId }]) },
      locationShare: { update: jest.fn().mockResolvedValue({ conversationId, updatedAt: 'now' }) },
      server: { to },
      logger: { error: jest.fn() },
    });
    await expect(gateway.onLocationShareUpdate(
      { data: { userId: sharerId } } as never,
      { sessionId: 'session-1', location },
    )).resolves.toMatchObject({ ok: true });
    expect(to.mock.calls.map(([room]: [string]) => room)).toEqual([
      `user:${sharerId}`,
      `user:${peerId}`,
    ]);
  });
});
