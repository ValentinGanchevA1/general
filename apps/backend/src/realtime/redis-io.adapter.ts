import { Logger } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { Server, type ServerOptions } from 'socket.io';
import { createRedisClient, type RedisEnvironment } from '../config/redis-client';
import {
  assertSocketIoRedisConfiguration,
  socketIoRedisChannelKey,
} from './socket-io-redis.config';

export class RedisIoAdapter extends IoAdapter {
  private readonly redisLogger = new Logger(RedisIoAdapter.name);
  private adapterConstructor: ReturnType<typeof createAdapter> | null = null;
  private publisher: Redis | null = null;
  private subscriber: Redis | null = null;

  async connectToRedis(env: RedisEnvironment = process.env): Promise<void> {
    assertSocketIoRedisConfiguration(env);

    const publisher = createRedisClient(
      {
        lazyConnect: true,
        maxRetriesPerRequest: null,
        connectionName: 'nexa-socketio-publisher',
      },
      env,
    );
    const subscriber = publisher.duplicate({
      lazyConnect: true,
      maxRetriesPerRequest: null,
      connectionName: 'nexa-socketio-subscriber',
    });

    this.attachErrorLogging(publisher, 'publisher');
    this.attachErrorLogging(subscriber, 'subscriber');

    try {
      await Promise.all([publisher.connect(), subscriber.connect()]);
      const channelKey = socketIoRedisChannelKey(env);
      this.adapterConstructor = createAdapter(publisher, subscriber, {
        key: channelKey,
        publishOnSpecificResponseChannel: true,
      });
      this.publisher = publisher;
      this.subscriber = subscriber;
      this.redisLogger.log(`Socket.IO Redis Pub/Sub connected (channel prefix: ${channelKey})`);
    } catch (error: unknown) {
      publisher.disconnect();
      subscriber.disconnect();
      throw error;
    }
  }

  createIOServer(port: number, options?: ServerOptions): Server {
    const adapterConstructor = this.adapterConstructor;
    if (!adapterConstructor) {
      throw new Error('RedisIoAdapter.connectToRedis() must succeed before creating Socket.IO');
    }

    const server = super.createIOServer(port, options) as Server;
    server.adapter(adapterConstructor);
    return server;
  }

  override async close(server: Parameters<IoAdapter['close']>[0]): Promise<void> {
    try {
      await super.close(server);
    } finally {
      await this.closeRedisConnections();
    }
  }

  private attachErrorLogging(client: Redis, role: 'publisher' | 'subscriber'): void {
    client.on('error', (error: Error) => {
      this.redisLogger.error(`Socket.IO Redis ${role} error: ${error.message}`);
    });
  }

  private async closeRedisConnections(): Promise<void> {
    const clients = [this.publisher, this.subscriber].filter(
      (client): client is Redis => client !== null,
    );

    this.publisher = null;
    this.subscriber = null;
    this.adapterConstructor = null;

    await Promise.allSettled(
      clients.map(async (client) => {
        if (client.status === 'end') return;
        if (client.status === 'wait') {
          client.disconnect();
          return;
        }

        try {
          await client.quit();
        } catch {
          client.disconnect();
        }
      }),
    );
  }
}
