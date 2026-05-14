import { Global, Module } from '@nestjs/common';
import { redisProvider, REDIS_CLIENT } from './redis.provider';

@Global()
@Module({
  providers: [redisProvider],
  exports: [redisProvider],
})
export class RedisModule {}
