import { RealtimeGateway } from './realtime.gateway';

const eventId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const userId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const room = `event:${eventId}`;

function setup() {
  const gateway = Object.create(RealtimeGateway.prototype) as RealtimeGateway;
  const trackedRooms = new Set<string>();
  const socketRooms = new Set<string>();
  const canView = jest.fn().mockResolvedValue(true);
  const join = jest.fn(async (name: string) => { socketRooms.add(name); });
  const leave = jest.fn(async (name: string) => { socketRooms.delete(name); });
  const disconnect = jest.fn();
  const logger = { error: jest.fn() };

  Object.assign(gateway, {
    eventRoomAccess: { canView },
    logger,
  });
  const client = {
    data: { userId, rooms: trackedRooms },
    join,
    leave,
    disconnect,
  };

  const attempt = () => gateway.onEventJoin(client as never, { eventId });
  return { attempt, gateway, client, canView, join, leave, disconnect, logger, trackedRooms, socketRooms };
}

describe('RealtimeGateway authorized event room lifecycle', () => {
  it('joins public or host-accessible events after two access checks', async () => {
    const { attempt, canView, join, leave, trackedRooms, socketRooms } = setup();
    await expect(attempt()).resolves.toEqual({ ok: true, data: { joined: true } });
    expect(canView).toHaveBeenNthCalledWith(1, userId, eventId);
    expect(canView).toHaveBeenNthCalledWith(2, userId, eventId);
    expect(join).toHaveBeenCalledWith(room);
    expect(leave).not.toHaveBeenCalled();
    expect(trackedRooms.has(room)).toBe(true);
    expect(socketRooms.has(room)).toBe(true);
  });

  it('never subscribes a user whose event is private, missing, or blocked', async () => {
    const { attempt, canView, join, trackedRooms } = setup();
    canView.mockResolvedValueOnce(false);
    await expect(attempt()).resolves.toEqual({
      ok: false, code: 'event.not_found', message: 'Event unavailable',
    });
    expect(canView).toHaveBeenCalledTimes(1);
    expect(join).not.toHaveBeenCalled();
    expect(trackedRooms.has(room)).toBe(false);
  });

  it('rolls back an event room when a block commits during adapter join', async () => {
    const { attempt, canView, join, leave, trackedRooms, socketRooms } = setup();
    canView.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    await expect(attempt()).resolves.toMatchObject({ ok: false, code: 'event.not_found' });
    expect(join).toHaveBeenCalledWith(room);
    expect(leave).toHaveBeenCalledWith(room);
    expect(trackedRooms.has(room)).toBe(false);
    expect(socketRooms.has(room)).toBe(false);
  });

  it('fails closed and leaves a pending room when the second DB check fails', async () => {
    const { attempt, canView, join, leave, logger, socketRooms } = setup();
    canView.mockResolvedValueOnce(true).mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(attempt()).resolves.toEqual({
      ok: false, code: 'event.unavailable', message: 'Event unavailable',
    });
    expect(join).toHaveBeenCalledTimes(1);
    expect(leave).toHaveBeenCalledWith(room);
    expect(socketRooms.has(room)).toBe(false);
    expect(logger.error).toHaveBeenCalled();
  });

  it('never subscribes when the initial DB check fails', async () => {
    const { attempt, canView, join } = setup();
    canView.mockRejectedValueOnce(new Error('DB unavailable'));
    await expect(attempt()).resolves.toMatchObject({ ok: false, code: 'event.unavailable' });
    expect(join).not.toHaveBeenCalled();
  });

  it('disconnects when an unauthorized room cannot be removed', async () => {
    const { attempt, canView, leave, disconnect, trackedRooms } = setup();
    canView.mockResolvedValueOnce(true).mockResolvedValueOnce(false);
    leave.mockRejectedValueOnce(new Error('adapter unavailable'));
    await expect(attempt()).resolves.toMatchObject({ ok: false, code: 'event.not_found' });
    expect(disconnect).toHaveBeenCalledWith(true);
    expect(trackedRooms.has(room)).toBe(false);
  });

  it('leaves a tracked room idempotently', async () => {
    const { gateway, client, trackedRooms, socketRooms, leave } = setup();
    trackedRooms.add(room);
    socketRooms.add(room);
    await expect(gateway.onEventLeave(client as never, { eventId }))
      .resolves.toEqual({ ok: true, data: { left: true } });
    expect(leave).toHaveBeenCalledWith(room);
    expect(trackedRooms.has(room)).toBe(false);
    expect(socketRooms.has(room)).toBe(false);
  });
});
