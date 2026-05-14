import { type FactoryProvider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const redisProvider: FactoryProvider<Redis> = {
  provide: REDIS_CLIENT,
  useFactory: () =>
    new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    }),
};
