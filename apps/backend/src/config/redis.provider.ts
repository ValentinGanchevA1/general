import { type FactoryProvider } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');

export const redisProvider: FactoryProvider<Redis> = {
  provide: REDIS_CLIENT,
  useFactory: () => {
    const url = process.env.REDIS_URL;
    if (url) {
      return new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 3 });
    }
    return new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
      lazyConnect: false,
      maxRetriesPerRequest: 3,
    });
  },
};
