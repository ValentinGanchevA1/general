import { ListingsExpiryService } from './listings-expiry.service';

describe('ListingsExpiryService', () => {
  const expiresAt = new Date('2026-10-25T00:00:00.000Z');
  const listing = { id: 'l1', expires_at: expiresAt, lat: 42.7, lng: 23.3 };
  const version = `l1:${expiresAt.getTime()}`;
  const lockKey = `discovery:listing-expiry:lock:${version}`;
  const doneKey = `discovery:listing-expiry:done:${version}`;

  function setup(rows = [listing]) {
    const db = { query: jest.fn().mockResolvedValue(rows) };
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
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

  it('publishes expiry without mutating active status and records this expiry version as done', async () => {
    const { service, db, redis, discovery } = setup();

    await service.sweep();

    const sql = String(db.query.mock.calls[0]![0]);
    expect(sql).toContain('SELECT id, expires_at');
    expect(sql).toContain("status = 'active'");
    expect(sql).toContain("visibility = 'public'");
    expect(sql).toContain('expires_at <= NOW()');
    expect(sql).not.toContain('UPDATE listings');
    expect(sql).not.toContain("SET status = 'withdrawn'");

    expect(redis.set).toHaveBeenNthCalledWith(
      1,
      lockKey,
      expect.any(String),
      'EX',
      120,
      'NX',
    );
    expect(discovery.publishEntityChangeToSubscribers).toHaveBeenCalledWith({
      kind: 'listing',
      entityId: 'l1',
      location: { lat: 42.7, lng: 23.3 },
      change: 'update',
    });
    expect(redis.set).toHaveBeenNthCalledWith(
      2,
      doneKey,
      '1',
      'EX',
      8 * 24 * 60 * 60,
    );
    const lockToken = redis.set.mock.calls[0]?.[1];
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('GET', KEYS[1]) == ARGV[1]"),
      1,
      lockKey,
      lockToken,
    );
  });

  it('skips an expiry version whose successful transition is already recorded', async () => {
    const { service, redis, discovery } = setup();
    redis.get.mockResolvedValue('1');

    await service.sweep();

    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
    expect(discovery.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });

  it('does not publish when another instance owns the short lock', async () => {
    const { service, redis, discovery } = setup();
    redis.set.mockResolvedValue(null);

    await service.sweep();

    expect(discovery.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
  });

  it('re-checks the done marker after acquiring the lock', async () => {
    const { service, redis, discovery } = setup();
    redis.get.mockResolvedValueOnce(null).mockResolvedValueOnce('1');

    await service.sweep();

    expect(discovery.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it('leaves no durable done marker on publication failure so a later sweep can retry', async () => {
    const { service, redis, discovery } = setup();
    discovery.publishEntityChangeToSubscribers.mockRejectedValue(new Error('redis unavailable'));

    await service.sweep();

    expect(redis.set).toHaveBeenCalledTimes(1);
    expect(redis.set).not.toHaveBeenCalledWith(
      doneKey,
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
    expect(redis.eval).toHaveBeenCalledTimes(1);
  });

  it('uses an ownership token so an expired worker cannot delete a replacement lock', async () => {
    const { service, redis } = setup();

    await service.sweep();

    const lockToken = redis.set.mock.calls[0]?.[1];
    expect(typeof lockToken).toBe('string');
    expect(lockToken).not.toBe('1');
    expect(redis.eval.mock.calls[0]?.[3]).toBe(lockToken);
  });

  it('does not publish when there are no expired public listings', async () => {
    const { service, redis, discovery } = setup([]);

    await service.sweep();

    expect(redis.get).not.toHaveBeenCalled();
    expect(redis.set).not.toHaveBeenCalled();
    expect(redis.eval).not.toHaveBeenCalled();
    expect(discovery.publishEntityChangeToSubscribers).not.toHaveBeenCalled();
  });
});
