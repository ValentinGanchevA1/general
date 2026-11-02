/**
 * Cross-navigator handoff for "View on map" / post-create pin focus.
 * Nested tab params are flaky when a root stack screen navigates to Main/Map
 * while Main is already mounted — this module carries the intent reliably.
 */

import type { ListingMode, VerificationLevel } from '@g88/shared';

export type PendingMapFocus = {
  userId?: string;
  listingId?: string;
  lat?: number;
  lng?: number;
  token: number;
  displayName?: string;
  avatarUrl?: string | null;
  verification?: VerificationLevel;
  online?: boolean;
  lastSeenAt?: string | null;
  title?: string;
  mode?: ListingMode;
  priceCents?: number;
  currency?: string;
  category?: string;
  thumbnailUrl?: string | null;
};

let pending: PendingMapFocus | null = null;
let tokenSeq = 0;

export function setPendingMapFocus(input: {
  userId?: string;
  listingId?: string;
  lat?: number;
  lng?: number;
  displayName?: string;
  avatarUrl?: string | null;
  verification?: VerificationLevel;
  online?: boolean;
  lastSeenAt?: string | null;
  title?: string;
  mode?: ListingMode;
  priceCents?: number;
  currency?: string;
  category?: string;
  thumbnailUrl?: string | null;
}): number {
  tokenSeq += 1;
  const hasCoords =
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);
  pending = {
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.listingId ? { listingId: input.listingId } : {}),
    ...(hasCoords ? { lat: input.lat as number, lng: input.lng as number } : {}),
    token: tokenSeq,
    ...(input.displayName != null ? { displayName: input.displayName } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    ...(input.verification != null ? { verification: input.verification } : {}),
    ...(input.online != null ? { online: input.online } : {}),
    ...(input.lastSeenAt != null ? { lastSeenAt: input.lastSeenAt } : {}),
    ...(input.title != null ? { title: input.title } : {}),
    ...(input.mode != null ? { mode: input.mode } : {}),
    ...(input.priceCents != null ? { priceCents: input.priceCents } : {}),
    ...(input.currency != null ? { currency: input.currency } : {}),
    ...(input.category != null ? { category: input.category } : {}),
    ...(input.thumbnailUrl !== undefined ? { thumbnailUrl: input.thumbnailUrl } : {}),
  };
  return tokenSeq;
}

export function peekPendingMapFocus(): PendingMapFocus | null {
  return pending;
}

export function clearPendingMapFocus(token?: number): void {
  if (token != null && pending != null && pending.token !== token) return;
  pending = null;
}
