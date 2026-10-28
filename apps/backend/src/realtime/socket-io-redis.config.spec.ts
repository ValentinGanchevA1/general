import {
  assertSocketIoRedisConfiguration,
  shouldUseSocketIoRedisAdapter,
  socketIoRedisChannelKey,
  socketIoRedisMode,
} from './socket-io-redis.config';

describe('Socket.IO Redis adapter config', () => {
  it('keeps local development on the in-memory adapter by default', () => {
    expect(shouldUseSocketIoRedisAdapter({ NODE_ENV: 'development' })).toBe(false);
  });

  it('enables the Redis adapter by default in production', () => {
    expect(
      shouldUseSocketIoRedisAdapter({ NODE_ENV: 'production', REDIS_URL: 'redis://redis:6379' }),
    ).toBe(true);
  });

  it('supports explicit enable and disable values', () => {
    expect(
      socketIoRedisMode({ SOCKET_IO_REDIS_ADAPTER: 'true' }),
    ).toBe('enabled');
    expect(
      socketIoRedisMode({ SOCKET_IO_REDIS_ADAPTER: 'off' }),
    ).toBe('disabled');
  });

  it('rejects unsupported adapter mode values', () => {
    expect(() => socketIoRedisMode({ SOCKET_IO_REDIS_ADAPTER: 'sometimes' })).toThrow(
      'SOCKET_IO_REDIS_ADAPTER must be one of',
    );
  });

  it('fails closed instead of silently using localhost when Redis is required', () => {
    expect(() =>
      assertSocketIoRedisConfiguration({ NODE_ENV: 'production' }),
    ).toThrow('REDIS_URL/REDIS_HOST is not configured');
  });

  it('accepts an explicit Redis host when the adapter is required', () => {
    expect(() =>
      assertSocketIoRedisConfiguration({ NODE_ENV: 'production', REDIS_HOST: 'redis.internal' }),
    ).not.toThrow();
  });

  it('namespaces Pub/Sub channels by environment outside Render', () => {
    expect(socketIoRedisChannelKey({ NODE_ENV: 'Preview / QA' })).toBe(
      'nexa:preview-qa:socket.io',
    );
  });

  it('isolates Render services and pull-request previews that share Redis', () => {
    expect(
      socketIoRedisChannelKey({ NODE_ENV: 'production', RENDER_SERVICE_ID: 'srv-production' }),
    ).toBe('nexa:production:srv-production:socket.io');
    expect(
      socketIoRedisChannelKey({
        NODE_ENV: 'production',
        IS_PULL_REQUEST: 'true',
        RENDER_SERVICE_ID: 'srv-preview-902',
      }),
    ).toBe('nexa:production:srv-preview-902:socket.io');
  });

  it('supports an explicit Pub/Sub channel prefix', () => {
    expect(
      socketIoRedisChannelKey({
        NODE_ENV: 'production',
        RENDER_SERVICE_ID: 'srv-production',
        SOCKET_IO_REDIS_CHANNEL_PREFIX: 'nexa:prod:realtime',
      }),
    ).toBe('nexa:prod:realtime');
  });
});
