import { EventsDiscoveryLifecycleService } from './events-discovery-lifecycle.service';

describe('EventsDiscoveryLifecycleService', () => {
  const event = { id: 'event-1', lat: 43.2, lng: 27.9 };

  function setup(rows = [event]) {
    const db = { query: jest.fn().mockResolvedValue(rows) };
    const redis = {
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

  it('publishes an update at the existing one-day discovery retention boundary', async () => {
    const { service, db, redis, discoveryRealtime } = setup();

    await service.sweep();

    expect(db.query).toHaveBeenCalledWith(expect.stringContaining("starts_at <= NOW() - interval '1 day'"));
    expect(redis.set).toHaveBeenCalledWith(
      'discovery:event-expiry:event-1',
      '1',
      'EX',
      8 * 24 * 60 * 60,
      'NX',
    );
    expect(discoveryRealtime.publishEntityChangeToSubscribers).toHaveBeenCalledWith({
      kind: 'event',
      entityId: 'event-1',
      location: { lat: 43.2, lng: 27.9 },
      change: 'update',
    });
  });

  it('does not republish when another instance already claimed the transition', async () => {
    const { service, redis, discoveryRealtime } = setup();
    redis.set.mockResolvedValue(null);

    await service.sweep();

    expect(discoveryRealtime.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });

  it('releases the claim when realtime publication fails so a later sweep can retry', async () => {
    const { service, redis, discoveryRealtime } = setup();
    discoveryRealtime.publishEntityChangeToSubscribers.mockRejectedValue(new Error('redis unavailable'));

    await service.sweep();

    expect(redis.del).toHaveBeenCalledWith('discovery:event-expiry:event-1');
  });

  it('is a no-op when there are no expired public events', async () => {
    const { service, redis, discoveryRealtime } = setup([]);

    await service.sweep();

    expect(redis.set).not.toHaveBeenCalled();
    expect(discoveryRealtime.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });
});
