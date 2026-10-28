import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

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
  placeLabel: string;
  locationH3R7: string;
}

/**
 * Produces anonymous place-level Pulse activity only after a k-anonymity
 * threshold is reached by explicit Nearby check-ins in the same coarse cell.
 * Friends-only check-ins never contribute to the aggregate.
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
          AND ci.location_h3_r7 = $2
          AND LOWER(ci.place_label) = LOWER($1)
          AND ci.created_at > NOW() - ($3 * interval '1 minute')`,
      [input.placeLabel, input.locationH3R7, TREND_WINDOW_MINUTES],
    );

    const distinctUsers = Number(countRow?.distinct_users ?? 0);
    if (distinctUsers < TREND_MIN_DISTINCT_USERS) return;

    const [trend] = await this.db.query<EmittedTrendRow[]>(
      `INSERT INTO pulse_place_trends
         (place_key, place_label, location_h3_r7, distinct_user_count,
          last_emitted_at, expires_at, updated_at)
       VALUES
         (LOWER($1), $1, $2, $3, NOW(),
          NOW() + ($4 * interval '1 minute'), NOW())
       ON CONFLICT (place_key, location_h3_r7)
       DO UPDATE SET
         place_label = EXCLUDED.place_label,
         distinct_user_count = EXCLUDED.distinct_user_count,
         last_emitted_at = NOW(),
         expires_at = NOW() + ($4 * interval '1 minute'),
         updated_at = NOW()
       WHERE pulse_place_trends.last_emitted_at
             <= NOW() - ($5 * interval '1 minute')
       RETURNING id, place_label, location_h3_r7, last_emitted_at`,
      [
        input.placeLabel,
        input.locationH3R7,
        distinctUsers,
        TREND_TTL_MINUTES,
        TREND_COOLDOWN_MINUTES,
      ],
    );

    if (!trend) return;

    // The realtime payload deliberately omits the threshold count, H3 cell,
    // and every participant identity. Postgres remains the recovery source.
    void this.realtime.publishPlaceTrend({
      trendId: trend.id,
      placeLabel: trend.place_label,
      locationH3R7: trend.location_h3_r7,
      createdAt: new Date(trend.last_emitted_at).toISOString(),
    }).catch(() => undefined);
  }
}
