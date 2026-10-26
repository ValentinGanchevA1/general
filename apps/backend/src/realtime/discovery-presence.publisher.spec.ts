import type Redis from 'ioredis';

import type { DiscoveryRealtimePublisher } from './discovery-realtime.publisher';
import { DiscoveryPresencePublisher } from './discovery-presence.publisher';

describe('DiscoveryPresencePublisher', () => {
  const createRedis = (state = new Map<string, string>()) => {
    const evalScript = jest.fn(
      async (_script: string, _keyCount: number, key: string, value: string, ttl: string) => {
        const previous = state.get(key) ?? null;
        state.set(key, value);
        return previous;
      },
    );
    return {
      redis: { eval: evalScript } as unknown as Redis,
      state,
      evalScript,
    };
  };

  const createSubject = (redisState = new Map<string, string>()) => {
    const publishEntityChangeToSubscribers = jest.fn().mockResolvedValue(1);
    const publishEntityMovement = jest.fn().mockResolvedValue(1);
    const discovery = {
      publishEntityChangeToSubscribers,
      publishEntityMovement,
    } as unknown as DiscoveryRealtimePublisher;
    const redis = createRedis(redisState);
    return {
      subject: new DiscoveryPresencePublisher(discovery, redis.redis),
      publishEntityChangeToSubscribers,
      publishEntityMovement,
      ...redis,
    };
  };

  it('publishes the first heartbeat as a current-location update', async () => {
    const { subject, publishEntityChangeToSubscribers, publishEntityMovement } = createSubject();
    const location = { lat: 43.2, lng: 27.9 };

    await subject.publishHeartbeat('user-1', location);

    expect(publishEntityChangeToSubscribers).toHaveBeenCalledWith({
      kind: 'user',
      entityId: 'user-1',
      location,
      change: 'update',
    });
    expect(publishEntityMovement).not.toHaveBeenCalled();
  });

  it('atomically replaces the routing location with its ttl', async () => {
    const { subject, evalScript } = createSubject();
    const location = { lat: 43.2, lng: 27.9 };

    await subject.publishHeartbeat('user-1', location);

    expect(evalScript).toHaveBeenCalledTimes(1);
    expect(evalScript).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])"),
      1,
      'discovery:presence-location:user-1',
      JSON.stringify(location),
      '180',
    );
  });

  it('routes later heartbeats with the previous Redis-backed location', async () => {
    const { subject, publishEntityMovement, evalScript } = createSubject();
    const previousLocation = { lat: 43.2, lng: 27.9 };
    const location = { lat: 43.25, lng: 27.95 };

    await subject.publishHeartbeat('user-1', previousLocation);
    await subject.publishHeartbeat('user-1', location);

    expect(publishEntityMovement).toHaveBeenCalledWith({
      kind: 'user',
      entityId: 'user-1',
      previousLocation,
      location,
    });
    expect(evalScript).toHaveBeenLastCalledWith(
      expect.any(String),
      1,
      'discovery:presence-location:user-1',
      JSON.stringify(location),
      '180',
    );
  });

  it('retains movement history across publisher instances', async () => {
    const redisState = new Map<string, string>();
    const first = createSubject(redisState);
    const second = createSubject(redisState);
    const previousLocation = { lat: 43.2, lng: 27.9 };
    const location = { lat: 43.3, lng: 28.0 };

    await first.subject.publishHeartbeat('user-1', previousLocation);
    await second.subject.publishHeartbeat('user-1', location);

    expect(second.publishEntityMovement).toHaveBeenCalledWith({
      kind: 'user',
      entityId: 'user-1',
      previousLocation,
      location,
    });
  });

  it('retains the routing origin across a process-local disconnect', async () => {
    const redisState = new Map<string, string>();
    const first = createSubject(redisState);
    const second = createSubject(redisState);
    const previousLocation = { lat: 43.2, lng: 27.9 };
    const location = { lat: 43.25, lng: 27.95 };

    await first.subject.publishHeartbeat('user-1', previousLocation);
    first.subject.clear('user-1');
    await second.subject.publishHeartbeat('user-1', location);

    expect(second.publishEntityMovement).toHaveBeenCalledWith({
      kind: 'user',
      entityId: 'user-1',
      previousLocation,
      location,
    });
  });
});
