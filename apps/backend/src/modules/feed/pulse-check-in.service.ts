import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import * as h3 from 'h3-js';

import {
  computeH3Cells,
  type CheckInAudience,
  type CreatePlacePulseCheckInRequest,
  type CreatePulseCheckInRequest,
  type PlaceIdentity,
  type PulseCheckInResult,
} from '@g88/shared';

import { MapTilerPlaceAttestationService } from './maptiler-place-attestation.service';
import { PlaceCatalogService } from './place-catalog.service';
import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';
import { PulsePlaceTrendingService } from './pulse-place-trending.service';

const CHECK_IN_TTL_MS = 6 * 60 * 60 * 1000;
const CHECK_IN_COOLDOWN_MINUTES = 15;
const MAX_PLACE_CELL_DISTANCE = 2;

interface ResolvedCatalogIdentity {
  placeId: string;
  placeIdentity: PlaceIdentity;
}

interface PersistCheckInInput {
  userId: string;
  placeLabel: string;
  placeId: string | null;
  placeIdentity: PlaceIdentity | null;
  trendLocationH3R7: string | null;
  audience: CheckInAudience;
  userCellH3R7: string;
}

@Injectable()
export class PulseCheckInService {
  private readonly logger = new Logger(PulseCheckInService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: PulseActivityRealtimeService,
    private readonly trending: PulsePlaceTrendingService,
    private readonly placeAttestation: MapTilerPlaceAttestationService,
    private readonly placeCatalog: PlaceCatalogService,
  ) {}

  async create(userId: string, input: CreatePulseCheckInRequest): Promise<PulseCheckInResult> {
    const fallbackPlaceLabel = this.normalizePlaceLabel(input.placeLabel);
    await this.assertCooldown(userId);

    const userCellH3R7 = computeH3Cells(input.lat, input.lng).r7;
    const resolved = await this.resolveCatalogIdentity(input, userCellH3R7);
    const placeIdentity = resolved?.placeIdentity ?? null;
    const placeId = resolved?.placeId ?? null;
    const placeLabel = placeIdentity?.canonicalLabel ?? fallbackPlaceLabel;

    return this.persist({
      userId,
      placeLabel,
      placeId,
      placeIdentity,
      trendLocationH3R7: placeIdentity?.providerCellH3R7 ?? null,
      audience: input.audience,
      userCellH3R7,
    });
  }

  async createForPlace(
    userId: string,
    input: CreatePlacePulseCheckInRequest,
  ): Promise<PulseCheckInResult> {
    await this.assertCooldown(userId);

    const userCellH3R7 = computeH3Cells(input.lat, input.lng).r7;
    const place = await this.placeCatalog.getActivePlace(input.placeId);
    if (!place) {
      throw new BadRequestException('This place is no longer available for check-in.');
    }
    if (!this.isNearby(userCellH3R7, place.locationH3R7)) {
      throw new BadRequestException('You need to be near this place to check in.');
    }

    return this.persist({
      userId,
      placeLabel: place.canonicalLabel,
      placeId: place.id,
      placeIdentity: null,
      trendLocationH3R7: place.locationH3R7,
      audience: input.audience,
      userCellH3R7,
    });
  }

  private async persist(input: PersistCheckInInput): Promise<PulseCheckInResult> {
    const id = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + CHECK_IN_TTL_MS);

    // Exact user/provider coordinates are deliberately discarded. Only server-derived coarse H3 r7 cells remain.
    await this.db.query(
      `INSERT INTO pulse_check_ins
         (id, user_id, place_label, audience, location_h3_r7,
          place_provider, place_provider_id, place_h3_r7, place_id,
          created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        id,
        input.userId,
        input.placeLabel,
        input.audience,
        input.userCellH3R7,
        input.placeIdentity?.provider ?? null,
        input.placeIdentity?.providerPlaceId ?? null,
        input.placeIdentity?.providerCellH3R7 ?? null,
        input.placeId,
        createdAt,
        expiresAt,
      ],
    );

    void this.realtime.publishCheckIn({
      checkInId: id,
      actorId: input.userId,
      placeLabel: input.placeLabel,
      audience: input.audience,
      locationH3R7: input.userCellH3R7,
      createdAt: createdAt.toISOString(),
    }).catch(() => undefined);

    // Only Nearby check-ins bound to a canonical NEXA place may contribute to public aggregate trends.
    if (input.audience === 'nearby' && input.placeId && input.trendLocationH3R7) {
      void this.trending.evaluateAfterCheckIn({
        placeId: input.placeId,
        canonicalLabel: input.placeLabel,
        locationH3R7: input.trendLocationH3R7,
        placeIdentity: input.placeIdentity,
      }).catch(() => undefined);
    }

    return {
      id,
      placeLabel: input.placeLabel,
      placeId: input.placeId,
      placeIdentity: input.placeIdentity,
      audience: input.audience,
      createdAt: createdAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
  }

  private async assertCooldown(userId: string): Promise<void> {
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
  }

  private async resolveCatalogIdentity(
    input: CreatePulseCheckInRequest,
    userCellH3R7: string,
  ): Promise<ResolvedCatalogIdentity | null> {
    if (!input.placeIdentity) return null;

    const attested = await this.placeAttestation.attest(input.placeIdentity, userCellH3R7);
    if (!attested) return null;

    try {
      const place = await this.placeCatalog.resolve(attested);
      return { placeId: place.id, placeIdentity: attested.identity };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'unknown catalog error';
      this.logger.warn(`Place catalog resolution failed; downgrading check-in: ${message}`);
      return null;
    }
  }

  private isNearby(userCellH3R7: string, placeCellH3R7: string): boolean {
    if (!h3.isValidCell(userCellH3R7) || h3.getResolution(userCellH3R7) !== 7) return false;
    if (!h3.isValidCell(placeCellH3R7) || h3.getResolution(placeCellH3R7) !== 7) return false;
    try {
      return h3.gridDistance(userCellH3R7, placeCellH3R7) <= MAX_PLACE_CELL_DISTANCE;
    } catch {
      return false;
    }
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
