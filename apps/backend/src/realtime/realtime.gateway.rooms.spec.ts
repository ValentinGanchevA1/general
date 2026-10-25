import { RealtimeGateway } from './realtime.gateway';

const CONVERSATION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('RealtimeGateway conversation room lifecycle', () => {
  it('leaves the Socket.IO room and tracked room set idempotently', async () => {
    const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
    const conversationRoom = `convo:${CONVERSATION_ID}`;
    const otherRoom = 'cell:8928308280fffff';
    const rooms = new Set([conversationRoom, otherRoom]);
    const leave = jest.fn();
    const client = {
      data: {
        userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        rooms,
      },
      leave,
    };

    const result = await gateway.onConversationLeave(
      client as never,
      { conversationId: CONVERSATION_ID },
    );

    expect(leave).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith(conversationRoom);
    expect(rooms.has(conversationRoom)).toBe(false);
    expect(rooms.has(otherRoom)).toBe(true);
    expect(result).toEqual({ ok: true, data: { left: true } });
  });
});
