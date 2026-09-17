import type { EntityKind, ListingMode, VerificationLevel } from '@g88/shared';

/**
 * Pure ranking for map discovery (server-authoritative).
 *
 * v1 design decisions (see product audit):
 * - No per-candidate mutualFriendsCount (listMutual is too expensive for 500 rows).
 * - Social signal = isFriend only (1.0 vs 0.28 baseline).
 * - Cold-start account-age boost deferred (extra join).
 * - Weights biased toward “alive near me” + verification ladder.
 */

export type DiscoveryRankBy = 'relevance' | 'distance' | 'newest';

export interface RankContext {
  viewerLat: number;
  viewerLng: number;
  viewerId: string;
}

export interface RankableEntity {
  id: string;
  kind: EntityKind;
  lat: number;
  lng: number;
  verification?: VerificationLevel;
  isFriend?: boolean;
  online?: boolean;
  lastSeenAt?: string | null;
  /** Listing created_at ISO if present in meta */
  createdAt?: string | null;
  /** Event starts_at ISO */
  startsAt?: string | null;
  mode?: ListingMode;
}

const TRUST: Record<VerificationLevel, number> = {
  none: 0.15,
  email: 0.45,
  phone: 0.7,
  selfie: 0.55,
  id: 1.0,
};

const W_DISTANCE = 0.35;
const W_TRUST = 0.25;
const W_SOCIAL = 0.2;
const W_FRESHNESS = 0.12;
const W_ACTIVITY = 0.08;

/** Haversine distance in metres. */
export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Distance score: 1 at same point, ~0.5 at ~280 m, decays. */
export function distanceScore(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const distM = haversineM(lat1, lng1, lat2, lng2);
  return 1 / (1 + distM / 280);
}

export function trustScore(level: VerificationLevel | undefined): number {
  return TRUST[level ?? 'none'] ?? 0.15;
}

/** isFriend → 1.0, else soft baseline so non-friends still appear. */
export function socialScore(isFriend: boolean | undefined): number {
  return isFriend === true ? 1.0 : 0.28;
}

export function freshnessScore(e: RankableEntity): number {
  if (e.kind === 'event' && e.startsAt) {
    const ageH = (Date.now() - new Date(e.startsAt).getTime()) / 3_600_000;
    // Upcoming or recent both score well; far past decays.
    return Math.exp(-Math.abs(ageH) / 48);
  }
  if (e.kind === 'listing' && e.createdAt) {
    const ageH = (Date.now() - new Date(e.createdAt).getTime()) / 3_600_000;
    return Math.exp(-ageH / 36);
  }
  // Users / missing timestamps: neutral
  return 0.5;
}

export function activityScore(
  online: boolean | undefined,
  lastSeenAt: string | null | undefined,
): number {
  if (online === true) return 1.0;
  if (lastSeenAt) {
    const mins = (Date.now() - new Date(lastSeenAt).getTime()) / 60_000;
    if (mins < 15) return 0.7;
    if (mins < 60) return 0.4;
  }
  return 0.2;
}

/**
 * Final score in [0, 1]. Kind multipliers applied after base mix.
 * Caller must already have filtered blocks / visibility / friendsOnly.
 */
export function computeRankScore(e: RankableEntity, ctx: RankContext): number {
  const d = distanceScore(ctx.viewerLat, ctx.viewerLng, e.lat, e.lng);
  const trust = trustScore(e.verification);
  const social = socialScore(e.isFriend);
  const fresh = freshnessScore(e);
  const activity = activityScore(e.online, e.lastSeenAt);

  let score =
    d * W_DISTANCE +
    trust * W_TRUST +
    social * W_SOCIAL +
    fresh * W_FRESHNESS +
    activity * W_ACTIVITY;

  if (e.isFriend) score *= 1.18;
  else if (e.kind === 'event') score *= 1.12;
  else if (e.kind === 'listing') score *= e.mode === 'buy' ? 1.08 : 1.06;

  return Math.min(1, Math.max(0, score));
}
