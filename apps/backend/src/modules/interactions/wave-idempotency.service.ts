import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import type Redis from 'ioredis';
import type { WaveRequest, WaveResponse } from '@g88/shared';

import { REDIS_CLIENT } from '../../config/redis.provider';
import { InteractionsService } from './interactions.service';

const RESULT_TTL_SECONDS = 120;
const LOCK_TTL_SECONDS = 8;
const WAIT_STEP_MS = 50;
const WAIT_ATTEMPTS = 40;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isWaveResponse(value: unknown): value is WaveResponse {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<WaveResponse>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.fromUserId === 'string' &&
    typeof candidate.toUserId === 'string' &&
    typeof candidate.createdAt === 'string' &&
    (candidate.conversationId === null || typeof candidate.conversationId === 'string')
  );
}

/**
 * Collapses duplicate Wave commands before they reach the durable interaction
 * transaction. The key is intentionally scoped by sender, recipient and
 * context. A repeated tap/network retry therefore receives the original
 * WaveResponse instead of creating a second row or surfacing wave.cooldown.
 *
 * Redis is only the idempotency coordination layer; the durable source of truth
 * remains InteractionsService + Postgres.
 */
@Injectable()
export class WaveIdempotencyService {
  constructor(
    private readonly interactions: InteractionsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async wave(fromUserId: string, req: WaveRequest): Promise<WaveResponse> {
    const context = req.context ?? 'map';
    const baseKey = `wave:idempotency:${fromUserId}:${req.toUserId}:${context}`;
    const resultKey = `${baseKey}:result`;
    const lockKey = `${baseKey}:lock`;

    const cached = await this.readCached(resultKey);
    if (cached) return cached;

    const acquired = await this.redis.set(
      lockKey,
      '1',
      'EX',
      LOCK_TTL_SECONDS,
      'NX',
    );

    if (acquired === 'OK') {
      try {
        const result = await this.interactions.wave(fromUserId, req);
        await this.redis.set(
          resultKey,
          JSON.stringify(result),
          'EX',
          RESULT_TTL_SECONDS,
        );
        return result;
      } finally {
        await this.redis.del(lockKey);
      }
    }

    for (let attempt = 0; attempt < WAIT_ATTEMPTS; attempt += 1) {
      await delay(WAIT_STEP_MS);
      const replay = await this.readCached(resultKey);
      if (replay) return replay;

      const lockStillHeld = await this.redis.exists(lockKey);
      if (lockStillHeld === 0) break;
    }

    // Do not run a second durable command while another request may still be
    // committing. The client can safely retry; successful attempts are cached.
    throw new ServiceUnavailableException({
      code: 'wave.in_flight',
      message: 'Wave is still being sent. Please retry.',
    });
  }

  private async readCached(key: string): Promise<WaveResponse | null> {
    const raw = await this.redis.get(key);
    if (!raw) return null;

    try {
      const parsed: unknown = JSON.parse(raw);
      return isWaveResponse(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
}
