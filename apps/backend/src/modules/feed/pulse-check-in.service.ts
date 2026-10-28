import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import {
  computeH3Cells,
  type CreatePulseCheckInRequest,
  type PlaceIdentity,
  type PulseCheckInResult,
} from '@g88/shared';

import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';
import { PulsePlaceTrendingService } from './pulse-place-trending.service';

const CHECK_IN_TTL_MS = 6 * 60 * 60 * 1000;
const CHECK_IN_COOLDOWN_MINUTES = 15;
const MAX_PLACE_CELL_DISTANCE = 2;

@Injectable()
export class PulseCheckInService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: PulseActivityRealtimeService,
    private readonly trending: PulsePlaceTrendingService,
  ) {}

  async create(userId: string, input: CreatePulseCheckInRequest): Promise<PulseCheckInResult> {
    const fallbackPlaceLabel = this.normalizePlaceLabel(input.placeLabel);
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
    const placeIdentity = this.normalizePlaceIdentity(input.placeIdentity, cell);
    const placeLabel = placeIdentity?.canonicalLabel ?? fallbackPlaceLabel;

    // Exact user and venue coordinates are deliberately discarded. Only coarse H3 r7 cells remain.
    await this.db.query(
      `INSERT INTO pulse_check_ins
         (id, user_id, place_label, audience, location_h3_r7,
          place_provider, place_provider_id, place_h3_r7, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        id,
        userId,
        placeLabel,
        input.audience,
        cell,
        placeIdentity?.provider ?? null,
        placeIdentity?.providerPlaceId ?? null,
        placeIdentity?.providerCellH3R7 ?? null,
        createdAt,
        expiresAt,
      ],
    );

    void this.realtime.publishCheckIn({
      checkInId: id,
      actorId: userId,
      placeLabel,
      audience: input.audience,
      locationH3R7: cell,
      createdAt: createdAt.toISOString(),
    }).catch(() => undefined);

    // Only provider-backed Nearby check-ins may contribute to public aggregate trends.
    if (input.audience === 'nearby' && placeIdentity) {
      void this.trending.evaluateAfterCheckIn({
        placeIdentity,
      }).catch(() => undefined);
    }

    return {
      id,
      placeLabel,
      placeIdentity,
      audience: input.audience,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  private normalizePlaceIdentity(input: PlaceIdentity | null, userCellH3R7: string): PlaceIdentity | null {
    if (!input) return null;
    if (input.provider !== 'maptiler') {
      throw new BadRequestException('Unsupported place provider.');
    }

    const providerPlaceId = input.providerPlaceId.trim();
    if (!providerPlaceId || providerPlaceId.length > 200 || this.hasControlCharacters(providerPlaceId)) {
      throw new BadRequestException('Invalid place identity.');
    }

    const canonicalLabel = this.normalizePlaceLabel(input.canonicalLabel);
    const providerCellH3R7 = input.providerCellH3R7.trim();
    if (!h3.isValidCell(providerCellH3R7) || h3.getResolution(providerCellH3R7) !== 7) {
      throw new BadRequestException('Invalid place area.');
    }

    let distance: number;
    try {
      distance = h3.gridDistance(userCellH3R7, providerCellH3R7);
    } catch {
      throw new BadRequestException('Invalid place area.');
    }
    if (distance > MAX_PLACE_CELL_DISTANCE) {
      throw new BadRequestException('Selected place is too far from your current area.');
    }

    return {
      provider: 'maptiler',
      providerPlaceId,
      canonicalLabel,
      providerCellH3R7,
    };
  }

  private normalizePlaceLabel(input: string): string {
    const trimmed = input.trim();
    if (this.hasControlCharacters(trimmed)) {
      throw new BadRequestException('Place name contains unsupported characters.');
    }

    const normalized = trimmed.split(' ').filter((part) => part.length > 0).join(' ');
    if (normalized.length < 2 || normalized.length > 80) {
      throw new BadRequestException('Place name must be between 2 and 80 characters.');
    }
    return normalized;
  }

  private hasControlCharacters(input: string): boolean {
    for (const char of input) {
      const code = char.charCodeAt(0);
      if (code < 32 || code === 127) return true;
    }
    return false;
  }
}
