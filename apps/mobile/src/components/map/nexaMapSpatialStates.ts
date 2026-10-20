export type NexaMapSpatialState =
  | 'ready'
  | 'starting'
  | 'loading'
  | 'refreshing'
  | 'empty'
  | 'error'
  | 'stale-error'
  | 'zoom-in';

export interface ResolveNexaMapSpatialStateArgs {
  hasRegion: boolean;
  loading: boolean;
  hasError: boolean;
  pointCount: number;
  viewportHash: string | null;
  isCityScale: boolean;
}

/**
 * Resolves map discovery UI without replacing the map surface.
 *
 * Priority matters:
 * - an oversized viewport needs a zoom hint instead of a false empty state;
 * - stale points stay visible when refresh fails;
 * - loading over existing data is a compact refresh state, not a blocker;
 * - true empty copy is only shown once the viewport is local enough to act on.
 */
export function resolveNexaMapSpatialState({
  hasRegion,
  loading,
  hasError,
  pointCount,
  viewportHash,
  isCityScale,
}: ResolveNexaMapSpatialStateArgs): NexaMapSpatialState {
  if (!hasRegion) return 'starting';
  if (viewportHash === 'too-large') return 'zoom-in';

  if (hasError) {
    return pointCount > 0 ? 'stale-error' : 'error';
  }

  if (loading) {
    return pointCount > 0 ? 'refreshing' : 'loading';
  }

  if (pointCount === 0 && isCityScale) return 'empty';
  return 'ready';
}
