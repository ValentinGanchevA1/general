import { ConversationRoomGateway } from './conversation-room.gateway';

describe('ConversationRoomGateway', () => {
  it('leaves the socket room and removes tracked membership', () => {
    const gateway = new ConversationRoomGateway();
    const conversationId = '11111111-1111-4111-8111-111111111111';
    const room = `conversation:${conversationId}`;
    const leave = jest.fn();
    const client = {
      leave,
      data: {
        userId: '22222222-2222-4222-8222-222222222222',
        rooms: new Set([room]),
      },
    } as unknown as Parameters<ConversationRoomGateway['onConversationLeave']>[0];

    expect(gateway.onConversationLeave(client, { conversationId })).toEqual({
      ok: true,
      data: { left: true },
    });
    expect(leave).toHaveBeenCalledWith(room);
    expect(client.data.rooms.has(room)).toBe(false);
  });
});
