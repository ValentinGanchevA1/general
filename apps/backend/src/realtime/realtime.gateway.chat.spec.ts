import { ForbiddenException } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

const conversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const senderId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const recipientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const message = { id: 'message-1', conversationId, senderId, body: 'hello', type: 'text' };

function setup(joined = true) {
  const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  const persist = jest.fn().mockResolvedValue(message);
  const getParticipantIds = jest.fn().mockResolvedValue([senderId, recipientId]);
  const push = jest.fn().mockResolvedValue(undefined);
  Object.assign(gateway, {
    server: { to },
    chat: { persist, getParticipantIds },
    logger: { warn: jest.fn(), error: jest.fn() },
    challenges: { increment: jest.fn().mockResolvedValue(undefined) },
    pushToOfflineParticipants: push,
  });
  const client = {
    rooms: new Set(joined ? [`convo:${conversationId}`] : []),
    data: { userId: senderId },
  };
  const send = () => gateway.onChatSend(client as never, { conversationId, body: 'hello', clientMessageId: 'client-1' });
  return { send, to, emit, persist, getParticipantIds, push };
}

describe('RealtimeGateway persisted text-message fanout', () => {
  it('uses one union broadcast to the conversation and every participant session', async () => {
    const { send, to, emit, push } = setup();
    await expect(send()).resolves.toEqual({ ok: true, data: message });
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith([
      `convo:${conversationId}`, `user:${senderId}`, `user:${recipientId}`,
    ]);
    expect(emit).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith('chat:message', message);
    expect(push).toHaveBeenCalledWith(conversationId, senderId, message.body);
  });

  it('does not broadcast or query participants when the socket has not joined', async () => {
    const { send, persist, getParticipantIds, emit } = setup(false);
    await expect(send()).resolves.toMatchObject({ ok: false, code: 'chat.forbidden' });
    expect(persist).not.toHaveBeenCalled();
    expect(getParticipantIds).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not fan out when authoritative persistence rejects the send', async () => {
    const { send, persist, getParticipantIds, emit } = setup();
    persist.mockRejectedValue(new ForbiddenException({ code: 'chat.forbidden', message: 'Denied' }));
    await expect(send()).resolves.toMatchObject({ ok: false, code: 'chat.forbidden' });
    expect(getParticipantIds).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('preserves successful delivery and ack if participant lookup fails after persistence', async () => {
    const { send, getParticipantIds, to, emit } = setup();
    getParticipantIds.mockRejectedValue(new Error('database unavailable'));
    await expect(send()).resolves.toEqual({ ok: true, data: message });
    expect(to).toHaveBeenCalledWith([`convo:${conversationId}`]);
    expect(emit).toHaveBeenCalledTimes(1);
  });
});
