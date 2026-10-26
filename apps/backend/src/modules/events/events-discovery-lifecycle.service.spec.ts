import { EventsDiscoveryLifecycleService } from './events-discovery-lifecycle.service';

describe('EventsDiscoveryLifecycleService', () => {
  const event = { id: 'event-1', lat: 43.2, lng: 27.9 };

  function setup(rows = [event]) {
    const db = { query: jest.fn().mockResolvedValue(rows) };
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    const discoveryRealtime = {
      publishEntityChangeToSubscribers: jest.fn().mockResolvedValue(0),
    };
    const service = new EventsDiscoveryLifecycleService(
      db as never,
      redis as never,
      discoveryRealtime as never,
    );
    return { service, db, redis, discoveryRealtime };
  }

  it('publishes once and records a durable done marker at the one-day boundary', async () => {
    const { service, db, redis, discoveryRealtime } = setup();

    await service.sweep();

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("starts_at <= NOW() - interval '1 day'"));
    expect(redis.set).toHaveBeenNthCalledWith(
      1,
      'discovery:event-expiry:lock:event-1',
      '1',
      'EX',
      120,
      'NX',
    );
    expect(discoveryRealtime.publishEntityChangeToSubscribers).toHaveBeenCalledWith({
      kind: 'event',
      entityId: 'event-1',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });
    expect(redis.set).toHaveBeenNthCalledWith(
      2,
      'discovery:event-expiry:done:event-1',
      '1',
      'EX',
      8 * 24 * 60 * 60,
    );
    expect(redis.del).toHaveBeenCalledWith('discovery:event-expiry:lock:event-1');
  });

  it('skips events whose successful transition is already recorded', async () => {
    const { service, redis, discoveryRealtime } = setup();
    redis.get.mockResolvedValue('1');

    await service.sweep();

    expect(redis.set).not.toHaveBeenCalled();
    expect(discoveryRealtime.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });

  it('does not publish when another instance owns the short processing lock', async () => {
    const { service, redis, discoveryRealtime } = setup();
    redis.set.mockResolvedValue(null);

    await service.sweep();

    expect(discoveryRealtime.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
    expect(redis.del).not.toHaveBeenCalled();
  });

  it('re-checks the done marker after winning the lock', async () => {
    const { service, redis, discoveryRealtime } = setup();
    redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce('1');

    await service.sweep();

    expect(discoveryRealtime.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('discovery:event-expiry:lock:event-1');
  });

  it('releases only the short lock when publication fails so a later sweep can retry', async () => {
    const { service, redis, discoveryRealtime } = setup();
    discoveryRealtime.publishEntityChangeToSubscribers.mockRejectedValue(new Error('redis unavailable'));

    await service.sweep();

    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).not.toHaveBeenCalledWith(
      'discovery:event-expiry:done:event-1',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(redis.del).toHaveBeenCalledWith('discovery:event-expiry:lock:event-1');
  });

  it('is a no-op when there are no expired public events', async () => {
    const { service, redis, discoveryRealtime } = setup([]);

    await service.sweep();

    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
    expect(discoveryRealtime.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });
});
