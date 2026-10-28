import Redis, { type RedisOptions } from 'ioredis';

export type RedisEnvironment = Readonly<Record<string, string | undefined>>;

const DEFAULT_REDIS_PORT = 6379;

export function hasExplicitRedisConfiguration(env: RedisEnvironment = process.env): boolean {
  return Boolean(env.REDIS_URL?.trim() || env.REDIS_HOST?.trim());
}

export function createRedisClient(
  options: RedisOptions = {},
  env: RedisEnvironment = process.env,
): Redis {
  const url = env.REDIS_URL?.trim();
  const redisOptions: RedisOptions = {
    lazyConnect: false,
    maxRetriesPerRequest: 3,
    ...options,
  };

  if (url) {
    return new Redis(url, redisOptions);
  }

  return new Redis({
    host: env.REDIS_HOST?.trim() || 'localhost',
    port: parseRedisPort(env.REDIS_PORT),
    ...redisOptions,
  });
}

function parseRedisPort(rawPort: string | undefined): number {
  if (!rawPort?.trim()) return DEFAULT_REDIS_PORT;

  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`REDIS_PORT must be an integer between 1 and 65535; received "${rawPort}"`);
  }
  return port;
}
