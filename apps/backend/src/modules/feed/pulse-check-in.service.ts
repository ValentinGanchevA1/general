import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

import {
  computeH3Cells,
  type CreatePulseCheckInRequest,
  type PulseCheckInResult,
} from '@g88/shared';

import { MapTilerPlaceAttestationService } from './maptiler-place-attestation.service';
import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';
import { PulsePlaceTrendingService } from './pulse-place-trending.service';

const CHECK_IN_TTL_MS = 6 * 60 * 60 * 1000;
const CHECK_IN_COOLDOWN_MINUTES = 15;

@Injectable()
export class PulseCheckInService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: PulseActivityRealtimeService,
    private readonly trending: PulsePlaceTrendingService,
    private readonly placeAttestation: MapTilerPlaceAttestationService,
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
    const placeIdentity = input.placeIdentity
      ? await this.placeAttestation.attest(input.placeIdentity, cell)
      : null;
    const placeLabel = placeIdentity?.canonicalLabel ?? fallbackPlaceLabel;

    // Exact user/provider coordinates are deliberately discarded. Only server-derived coarse H3 r7 cells remain.
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

    // Only server-attested provider-backed Nearby check-ins may contribute to public aggregate trends.
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
