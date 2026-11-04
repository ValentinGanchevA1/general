/**
 * PostgreSQL relevance shortlist. Keeps all scoring terms in the database so
 * a dense viewport never transfers every lightweight candidate to Node.js.
 *
 * The expressions intentionally track ranking/scoring.ts. Release activation
 * requires the PostGIS equivalence test and performance benchmark.
 */
export interface SqlTopKBindings {
  viewerLat: number;
  viewerLng: number;
  nowMs: number;
  friends: number;
  online: number;
  lastSeen: number;
  limit: number;
}

export function buildRelevanceTopKSql(
  baseWhere: string,
  latSql: string,
  lngSql: string,
  bind: SqlTopKBindings,
): string {
  const p = (idx: number): string => '$' + String(idx);

  return `
    WITH candidates AS MATERIALIZED (
      SELECT id, kind,
             ${latSql} AS lat,
             ${lngSql} AS lng,
             meta->>'verification' AS verification,
             meta->>'startsAt' AS starts_at,
             meta->>'createdAt' AS created_at,
             meta->>'mode' AS listing_mode
        ${baseWhere}
    ),
    signals AS (
      SELECT id, kind, verification, starts_at, created_at, listing_mode,
             (kind = 'user' AND id = ANY(${p(bind.friends)}::uuid[])) AS is_friend,
             (kind = 'user' AND id = ANY(${p(bind.online)}::uuid[])) AS is_online,
             (${p(bind.lastSeen)}::jsonb ->> id::text)::double precision AS last_seen_ms,
             (
               POWER(SIN(RADIANS((lat - ${p(bind.viewerLat)}::double precision) / 2.0)), 2)
               + COS(RADIANS(${p(bind.viewerLat)}::double precision))
               * COS(RADIANS(lat))
               * POWER(SIN(RADIANS((lng - ${p(bind.viewerLng)}::double precision) / 2.0)), 2)
             ) AS haversine_a
        FROM candidates
    ),
    components AS (
      SELECT id, kind, is_friend, listing_mode,
             1.0 / (
               1.0 + 12742000.0 * ATAN2(
                 SQRT(LEAST(1.0, GREATEST(0.0, haversine_a))),
                 SQRT(LEAST(1.0, GREATEST(0.0, 1.0 - haversine_a)))
               ) / 280.0
             ) AS distance_score,
             CASE WHEN kind = 'user' THEN
               CASE verification
                 WHEN 'email' THEN 0.45
                 WHEN 'phone' THEN 0.70
                 WHEN 'selfie' THEN 0.55
                 WHEN 'id' THEN 1.00
                 ELSE 0.15
               END
               ELSE 0.15
             END AS trust_score,
             CASE
               WHEN kind = 'event' AND starts_at IS NOT NULL THEN
                 EXP(-ABS((
                   ${p(bind.nowMs)}::double precision
                   - EXTRACT(EPOCH FROM starts_at::timestamptz) * 1000.0
                 ) / 3600000.0) / 48.0)
               WHEN kind = 'listing' AND created_at IS NOT NULL THEN
                 EXP(-((
                   ${p(bind.nowMs)}::double precision
                   - EXTRACT(EPOCH FROM created_at::timestamptz) * 1000.0
                 ) / 3600000.0) / 36.0)
               ELSE 0.5
             END AS freshness_score,
             CASE
               WHEN is_online THEN 1.0
               WHEN is_friend AND last_seen_ms IS NOT NULL AND
                 (${p(bind.nowMs)}::double precision - last_seen_ms) / 60000.0 < 15 THEN 0.7
               WHEN is_friend AND last_seen_ms IS NOT NULL AND
                 (${p(bind.nowMs)}::double precision - last_seen_ms) / 60000.0 < 60 THEN 0.4
               ELSE 0.2
             END AS activity_score
        FROM signals
    ),
    scored AS (
      SELECT id, kind,
             LEAST(1.0, GREATEST(0.0,
               (
                 distance_score * 0.35 + trust_score * 0.25
                 + (CASE WHEN is_friend THEN 1.0 ELSE 0.28 END) * 0.20
                 + freshness_score * 0.12 + activity_score * 0.08
               ) * CASE
                 WHEN is_friend THEN 1.18
                 WHEN kind = 'event' THEN 1.12
                 WHEN kind = 'listing' AND listing_mode = 'buy' THEN 1.08
                 WHEN kind = 'listing' THEN 1.06
                 ELSE 1.0
               END
             )) AS rank_score
        FROM components
    )
    SELECT id, kind
      FROM scored
     ORDER BY rank_score DESC, kind ASC, id ASC
     LIMIT ${p(bind.limit)}::integer
  `;
}
