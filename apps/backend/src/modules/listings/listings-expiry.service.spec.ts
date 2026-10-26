import { ListingsExpiryService } from './listings-expiry.service';

describe('ListingsExpiryService', () => {
  const expiresAt = new Date('2026-10-25T00:00:00.000Z');
  const listing = { id: 'l1', expires_at: expiresAt, lat: 42.7, lng: 23.3 };

  function setup(rows = [listing]) {
    const db = { query: jest.fn().mockResolvedValue(rows) };
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    const discovery = {
      publishEntityChangeToSubscribers: jest.fn().mockResolvedValue(0),
    };
    const service = new ListingsExpiryService(
      db as never,
      redis as never,
      discovery as never,
    );
    return { service, db, redis, discovery };
  }

  it('publishes expiry without mutating the active listing status', async () => {
    const { service, db, redis, discovery } = setup();

    await service.sweep();

    const sql = String(db.query.mock.calls[0]![0]);
    expect(sql).toContain('SELECT id, expires_at');
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("visibility = 'public'");
    expect(sql).toContain('expires_at <= NOW()');
    expect(sql).not.toContain('UPDATE listings');
    expect(sql).not.toContain("SET status = 'withdrawn'");

    expect(redis.set).toHaveBeenCalledWith(
      `discovery:listing-expiry:l1:${expiresAt.getTime()}`,
      '1',
      'EX',
      8 * 24 * 60 * 60,
      'NX',
    );
    expect(discovery.publishEntityChangeToSubscribers).toHaveBeenCalledWith({
      kind: 'listing',
      entityId: 'l1',
      location: { lat: 42.7, lng: 23.3 },
      change: 'update',
    });
  });

  it('does not republish when another instance already claimed this expiry version', async () => {
    const { service, redis, discovery } = setup();
    redis.set.mockResolvedValue(null);

    await service.sweep();

    expect(discovery.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });

  it('releases the versioned claim when realtime publication fails', async () => {
    const { service, redis, discovery } = setup();
    discovery.publishEntityChangeToSubscribers.mockRejectedValue(new Error('redis unavailable'));

    await service.sweep();

    expect(redis.del).toHaveBeenCalledWith(
      `discovery:listing-expiry:l1:${expiresAt.getTime()}`,
    );
  });

  it('does not publish when there are no expired public listings', async () => {
    const { service, redis, discovery } = setup([]);

    await service.sweep();

    expect(redis.set).not.toHaveBeenCalled();
    expect(discovery.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });
});
