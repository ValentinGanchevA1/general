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
  const dbQuery = jest.fn().mockResolvedValue([
    { user_id: senderId },
    { user_id: recipientId },
  ]);
  const push = jest.fn().mockResolvedValue(undefined);
  Object.assign(gateway, {
    server: { to },
    db: { query: dbQuery },
    chat: { persist },
    logger: { warn: jest.fn(), error: jest.fn() },
    challenges: { increment: jest.fn().mockResolvedValue(undefined) },
    pushToOfflineParticipants: push,
  });
  const client = {
    rooms: new Set(joined ? [`convo:${conversationId}`] : []),
    data: { userId: senderId },
  };
  const send = () =>
    gateway.onChatSend(client as never, {
      conversationId,
      body: 'hello',
      clientMessageId: 'client-1',
    });
  return { send, to, emit, persist, dbQuery, push };
}

describe('RealtimeGateway persisted text-message fanout', () => {
  it('reauthorizes recipients and emits only to their user rooms', async () => {
    const { send, to, emit, dbQuery, push } = setup();
    await expect(send()).resolves.toEqual({ ok: true, data: message });
    expect(dbQuery).toHaveBeenCalledTimes(1);
    expect(dbQuery).toHaveBeenCalledWith(expect.stringContaining('user_blocks'), [conversationId]);
    expect(to).toHaveBeenCalledTimes(2);
    expect(to).toHaveBeenNthCalledWith(1, `user:${senderId}`);
    expect(to).toHaveBeenNthCalledWith(2, `user:${recipientId}`);
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(1, 'chat:message', message);
    expect(emit).toHaveBeenNthCalledWith(2, 'chat:message', message);
    expect(push).toHaveBeenCalledWith(conversationId, senderId, message.body);
  });

  it('does not broadcast or query recipients when the socket has not joined', async () => {
    const { send, persist, dbQuery, emit } = setup(false);
    await expect(send()).resolves.toMatchObject({ ok: false, code: 'chat.forbidden' });
    expect(persist).not.toHaveBeenCalled();
    expect(dbQuery).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('does not fan out when authoritative persistence rejects the send', async () => {
    const { send, persist, dbQuery, emit } = setup();
    persist.mockRejectedValue(new ForbiddenException({ code: 'chat.forbidden', message: 'Denied' }));
    await expect(send()).resolves.toMatchObject({ ok: false, code: 'chat.forbidden' });
    expect(dbQuery).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });

  it('fails closed when recipient reauthorization fails after persistence', async () => {
    const { send, dbQuery, to, emit } = setup();
    dbQuery.mockRejectedValue(new Error('database unavailable'));
    await expect(send()).resolves.toMatchObject({
      ok: false,
      code: 'chat.failed',
      message: 'database unavailable',
    });
    expect(to).not.toHaveBeenCalled();
    expect(emit).not.toHaveBeenCalled();
  });
});
