import { type FactoryProvider } from '@nestjs/common';
import Redis from 'ioredis';
import { createRedisClient } from './redis-client';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const redisProvider: FactoryProvider<Redis> = {
  provide: REDIS_CLIENT,
  useFactory: () => createRedisClient(),
};
