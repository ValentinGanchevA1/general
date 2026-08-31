/**
 * Cross-navigator handoff for "View on map".
 * Nested tab params are flaky when UserProfile (root stack) navigates to Main/Map
 * while Main is already mounted — this module carries the intent reliably.
 */

export type PendingMapFocus = {
  userId: string;
  lat?: number;
  lng?: number;
  /** Monotonic token so the same peer can be focused again. */
  token: number;
};

let pending: PendingMapFocus | null = null;
let tokenSeq = 0;

export function setPendingMapFocus(input: {
  userId: string;
  lat?: number;
  lng?: number;
}): number {
  tokenSeq += 1;
  const hasCoords =
    input.lat != null &&
    input.lng != null &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng);
  pending = {
    userId: input.userId,
    ...(hasCoords ? { lat: input.lat as number, lng: input.lng as number } : {}),
    token: tokenSeq,
  };
  return tokenSeq;
}

/** Peek without clearing (Map may retry until region/points ready). */
export function peekPendingMapFocus(): PendingMapFocus | null {
  return pending;
}

export function clearPendingMapFocus(token?: number): void {
  if (token != null && pending != null && pending.token !== token) return;
  pending = null;
}
