import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import type { PlaceIdentity } from '@g88/shared';

import { PulseActivityRealtimeService } from './pulse-activity-realtime.service';

const TREND_WINDOW_MINUTES = 30;
const TREND_MIN_DISTINCT_USERS = 5;
const TREND_COOLDOWN_MINUTES = 120;
const TREND_TTL_MINUTES = 90;

interface TrendCountRow {
  distinct_users: number;
}

interface EmittedTrendRow {
  id: string;
  place_label: string;
  location_h3_r7: string;
  last_emitted_at: Date;
}

export interface EvaluatePlaceTrendInput {
  placeId: string;
  canonicalLabel: string;
  locationH3R7: string;
  /** Optional legacy provider metadata. NEXA placeId is authoritative. */
  placeIdentity: PlaceIdentity | null;
}

/**
 * Produces anonymous place-level Pulse activity only for NEXA-catalog places
 * after a k-anonymity threshold is reached by explicit Nearby check-ins.
 */
@Injectable()
export class PulsePlaceTrendingService {
  constructor(
    @InjectDataSource() private readonly db: DataSource,
    private readonly realtime: PulseActivityRealtimeService,
  ) {}

  async evaluateAfterCheckIn(input: EvaluatePlaceTrendInput): Promise<void> {
    const [countRow] = await this.db.query<TrendCountRow[]>(
      `SELECT COUNT(DISTINCT ci.user_id)::int AS distinct_users
         FROM pulse_check_ins ci
         JOIN users u ON u.id = ci.user_id AND u.deleted_at IS NULL
        WHERE ci.deleted_at IS NULL
          AND ci.expires_at > NOW()
          AND ci.audience = 'nearby'
          AND ci.place_id = $1
          AND ci.created_at > NOW() - ($2 * interval '1 minute')`,
      [input.placeId, TREND_WINDOW_MINUTES],
    );

    const distinctUsers = Number(countRow?.distinct_users ?? 0);
    if (distinctUsers < TREND_MIN_DISTINCT_USERS) return;

    const placeKey = `nexa:${input.placeId}`;
    const [trend] = await this.db.query<EmittedTrendRow[]>(
      `INSERT INTO pulse_place_trends
         (place_key, place_label, location_h3_r7, distinct_user_count,
          place_provider, place_provider_id, place_id,
          last_emitted_at, expires_at, updated_at)
       VALUES
         ($1, $2, $3, $4, $5, $6, $7, NOW(),
          NOW() + ($8 * interval '1 minute'), NOW())
       ON CONFLICT (place_id) WHERE place_id IS NOT NULL
       DO UPDATE SET
         place_key = EXCLUDED.place_key,
         place_label = EXCLUDED.place_label,
         location_h3_r7 = EXCLUDED.location_h3_r7,
         distinct_user_count = EXCLUDED.distinct_user_count,
         place_provider = COALESCE(EXCLUDED.place_provider, pulse_place_trends.place_provider),
         place_provider_id = COALESCE(EXCLUDED.place_provider_id, pulse_place_trends.place_provider_id),
         last_emitted_at = NOW(),
         expires_at = NOW() + ($8 * interval '1 minute'),
         updated_at = NOW()
       WHERE pulse_place_trends.last_emitted_at
             <= NOW() - ($9 * interval '1 minute')
       RETURNING id, place_label, location_h3_r7, last_emitted_at`,
      [
        placeKey,
        input.canonicalLabel,
        input.locationH3R7,
        distinctUsers,
        input.placeIdentity?.provider ?? null,
        input.placeIdentity?.providerPlaceId ?? null,
        input.placeId,
        TREND_TTL_MINUTES,
        TREND_COOLDOWN_MINUTES,
      ],
    );

    if (!trend) return;

    void this.realtime.publishPlaceTrend({
      trendId: trend.id,
      placeLabel: trend.place_label,
      locationH3R7: trend.location_h3_r7,
      createdAt: new Date(trend.last_emitted_at).toISOString(),
    }).catch(() => undefined);
  }
}
