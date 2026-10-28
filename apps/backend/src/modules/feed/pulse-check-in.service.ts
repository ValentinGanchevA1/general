import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import {
  computeH3Cells,
  type CreatePulseCheckInRequest,
  type PulseCheckInResult,
} from '@g88/shared';

import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';

const CHECK_IN_TTL_MS = 6 * 60 * 60 * 1000;
const CHECK_IN_COOLDOWN_MINUTES = 15;

@Injectable()
export class PulseCheckInService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: PulseActivityRealtimeService,
  ) {}

  async create(userId: string, input: CreatePulseCheckInRequest): Promise<PulseCheckInResult> {
    const placeLabel = this.normalizePlaceLabel(input.placeLabel);
    const [recent] = await this.db.query<Array<{ id: string }>>(
      `SELECT id
         FROM pulse_check_ins
        WHERE user_id = $1
          AND deleted_at IS NULL
          AND created_at > NOW() - ($2 * interval '1 minute')
        ORDER BY created_at DESC
        LIMIT 1`,
      [userId, CHECK_IN_COOLDOWN_MINUTES],
    );

    if (recent) {
      throw new HttpException(
        `You can check in again after ${CHECK_IN_COOLDOWN_MINUTES} minutes.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const id = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + CHECK_IN_TTL_MS);
    const cell = computeH3Cells(input.lat, input.lng).r7;

    // Exact coordinates are deliberately discarded after deriving the coarse cell.
    await this.db.query(
      `INSERT INTO pulse_check_ins
         (id, user_id, place_label, audience, location_h3_r7, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, userId, placeLabel, input.audience, cell, createdAt, expiresAt],
    );

    // Realtime is best-effort. Persistence succeeded already, so a Redis/socket
    // outage must not turn a successful check-in into an API failure; REST /feed
    // remains the source-of-truth recovery path.
    void this.realtime.publishCheckIn({
      checkInId: id,
      actorId: userId,
      placeLabel,
      audience: input.audience,
      locationH3R7: cell,
      createdAt: createdAt.toISOString(),
    }).catch(() => undefined);

    return {
      id,
      placeLabel,
      audience: input.audience,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  private normalizePlaceLabel(input: string): string {
    const trimmed = input.trim();
    for (const char of trimmed) {
      const code = char.charCodeAt(0);
      if (code < 32 || code === 127) {
        throw new BadRequestException('Place name contains unsupported characters.');
      }
    }

    const normalized = trimmed.split(' ').filter((part) => part.length > 0).join(' ');
    if (normalized.length < 2 || normalized.length > 80) {
      throw new BadRequestException('Place name must be between 2 and 80 characters.');
    }
    return normalized;
  }
}
