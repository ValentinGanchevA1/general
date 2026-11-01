import { ForbiddenException } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';

const conversationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const senderId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const recipientId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const memberCId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const message = { id: 'message-1', conversationId, senderId, body: 'hello', type: 'text' };

function setup(joined = true) {
  const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
  const emit = jest.fn();
  const to = jest.fn().mockReturnValue({ emit });
  const persist = jest.fn().mockResolvedValue(message);
  const getRecipientIds = jest.fn().mockResolvedValue([senderId, recipientId]);
  const push = jest.fn().mockResolvedValue(undefined);
  Object.assign(gateway, {
    server: { to },
    chat: { persist },
    chatRealtimeAccess: { getRecipientIds },
    logger: { warn: jest.fn(), error: jest.fn() },
    challenges: { increment: jest.fn().mockResolvedValue(undefined) },
    pushToOfflineParticipants: push,
  });
  const rooms = new Set(joined ? [`convo:${conversationId}`] : []);
  const client = {
    rooms,
    data: { userId: senderId, rooms },
  };
  const send = () =>
    gateway.onChatSend(client as never, {
      conversationId,
      body: 'hello',
      clientMessageId: 'client-1',
    });
  return { gateway, client, send, to, emit, persist, getRecipientIds, push };
}

describe('RealtimeGateway persisted text-message fanout', () => {
  it('reauthorizes recipients and emits only to their user rooms', async () => {
    const { send, to, emit, getRecipientIds, push } = setup();
    await expect(send()).resolves.toEqual({ ok: true, data: message });
    expect(getRecipientIds).toHaveBeenCalledTimes(1);
    expect(getRecipientIds).toHaveBeenCalledWith(conversationId, false);
    expect(to).toHaveBeenCalledTimes(2);
    expect(to).toHaveBeenNthCalledWith(1, `user:${senderId}`);
    expect(to).toHaveBeenNthCalledWith(2, `user:${recipientId}`);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(1, 'chat:message', message);
    expect(emit).toHaveBeenNthCalledWith(2, 'chat:message', message);
    expect(push).toHaveBeenCalledWith(conversationId, senderId, message.body);
  });

  it('fans a group message out to every currently authorized active member', async () => {
    const { send, to, emit, getRecipientIds } = setup();
    getRecipientIds.mockResolvedValue([senderId, recipientId, memberCId]);

    await expect(send()).resolves.toEqual({ ok: true, data: message });
    expect(to).toHaveBeenCalledTimes(3);
    expect(to).toHaveBeenNthCalledWith(1, `user:${senderId}`);
    expect(to).toHaveBeenNthCalledWith(2, `user:${recipientId}`);
    expect(to).toHaveBeenNthCalledWith(3, `user:${memberCId}`);
    expect(emit).toHaveBeenCalledTimes(3);
  });

  it('does not deliver to a previously joined but newly unauthorized recipient', async () => {
    const { send, to, emit, getRecipientIds } = setup();
    getRecipientIds.mockResolvedValue([senderId]);
    await expect(send()).resolves.toEqual({ ok: true, data: message });
    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith(`user:${senderId}`);
    expect(to).not.toHaveBeenCalledWith(`user:${recipientId}`);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it('does not broadcast or resolve recipients when the socket has not joined', async () => {
    const { send, persist, getRecipientIds, emit } = setup(false);
    await expect(send()).resolves.toMatchObject({ ok: false, code: 'chat.forbidden' });
    expect(persist).not.toHaveBeenCalled();
    expect(getRecipientIds).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not fan out when authoritative persistence rejects the send', async () => {
    const { send, persist, getRecipientIds, emit } = setup();
    persist.mockRejectedValue(new ForbiddenException({ code: 'chat.forbidden', message: 'Denied' }));
    await expect(send()).resolves.toMatchObject({ ok: false, code: 'chat.forbidden' });
    expect(getRecipientIds).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('fails closed when recipient reauthorization fails after persistence', async () => {
    const { send, getRecipientIds, to, emit } = setup();
    getRecipientIds.mockRejectedValue(new Error('database unavailable'));
    await expect(send()).resolves.toMatchObject({
      ok: false,
      code: 'chat.failed',
      message: 'database unavailable',
    });
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});

describe('RealtimeGateway conversation join authorization', () => {
  it('allows an active normalized group member to join the conversation room', async () => {
    const { gateway, client, getRecipientIds } = setup(false);
    const join = jest.fn();
    Object.assign(client, { join });
    getRecipientIds.mockResolvedValue([senderId, recipientId, memberCId]);

    await expect(
      gateway.onConversationJoin(client as never, { conversationId }),
    ).resolves.toEqual({ ok: true, data: { joined: true } });
    expect(getRecipientIds).toHaveBeenCalledWith(conversationId, false);
    expect(join).toHaveBeenCalledWith(`convo:${conversationId}`);
    expect(client.rooms.has(`convo:${conversationId}`)).toBe(true);
  });

  it('rejects a left or otherwise unauthorized group member', async () => {
    const { gateway, client, getRecipientIds } = setup(false);
    const join = jest.fn();
    Object.assign(client, { join });
    getRecipientIds.mockResolvedValue([recipientId, memberCId]);

    await expect(
      gateway.onConversationJoin(client as never, { conversationId }),
    ).resolves.toMatchObject({ ok: false, code: 'chat.forbidden' });
    expect(join).not.toHaveBeenCalled();
    expect(client.rooms.has(`convo:${conversationId}`)).toBe(false);
  });
});
