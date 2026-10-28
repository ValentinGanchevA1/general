import {
  hasExplicitRedisConfiguration,
  type RedisEnvironment,
} from '../config/redis-client';

export type SocketIoRedisMode = 'auto' | 'enabled' | 'disabled';

const TRUE_VALUES = new Set(['1', 'true', 'enabled', 'on']);
const FALSE_VALUES = new Set(['0', 'false', 'disabled', 'off']);

export function socketIoRedisMode(env: RedisEnvironment = process.env): SocketIoRedisMode {
  const rawMode = env.SOCKET_IO_REDIS_ADAPTER?.trim().toLowerCase();
  if (!rawMode || rawMode === 'auto') return 'auto';
  if (TRUE_VALUES.has(rawMode)) return 'enabled';
  if (FALSE_VALUES.has(rawMode)) return 'disabled';

  throw new Error(
    'SOCKET_IO_REDIS_ADAPTER must be one of auto, enabled/true/1/on, or disabled/false/0/off',
  );
}

export function shouldUseSocketIoRedisAdapter(
  env: RedisEnvironment = process.env,
): boolean {
  const mode = socketIoRedisMode(env);
  if (mode === 'enabled') return true;
  if (mode === 'disabled') return false;
  return env.NODE_ENV === 'production';
}

export function assertSocketIoRedisConfiguration(
  env: RedisEnvironment = process.env,
): void {
  if (!shouldUseSocketIoRedisAdapter(env)) return;
  if (hasExplicitRedisConfiguration(env)) return;

  throw new Error(
    'Socket.IO Redis adapter is enabled but REDIS_URL/REDIS_HOST is not configured; refusing an implicit localhost fallback',
  );
}

export function socketIoRedisChannelKey(env: RedisEnvironment = process.env): string {
  const explicitPrefix = env.SOCKET_IO_REDIS_CHANNEL_PREFIX?.trim();
  if (explicitPrefix) return explicitPrefix;

  const environment = normalizeSegment(env.NODE_ENV ?? 'development');
  const renderServiceId = env.RENDER_SERVICE_ID?.trim();
  if (renderServiceId) {
    return `nexa:${environment}:${normalizeSegment(renderServiceId)}:socket.io`;
  }

  return `nexa:${environment}:socket.io`;
}

function normalizeSegment(value: string): string {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
  return normalized || 'development';
}
