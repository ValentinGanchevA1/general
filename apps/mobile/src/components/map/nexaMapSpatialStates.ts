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
  /** Renderer-local Place discovery can load independently from legacy discovery. */
  placeLoading?: boolean;
  /** Renderer-local Place discovery can fail independently from legacy discovery. */
  placeHasError?: boolean;
  /** True when at least one public/private/focused Place is currently visible. */
  hasPlacePoints?: boolean;
}

/**
 * Resolves map discovery UI without replacing the map surface.
 *
 * Priority matters:
 * - an oversized viewport needs a zoom hint instead of a false empty state;
 * - stale points stay visible when either discovery lane fails;
 * - loading over existing data is a compact refresh state, not a blocker;
 * - renderer-local Place points count as visible map content;
 * - true empty copy is only shown once the viewport is local enough to act on.
 */
export function resolveNexaMapSpatialState({
  hasRegion,
  loading,
  hasError,
  pointCount,
  viewportHash,
  isCityScale,
  placeLoading = false,
  placeHasError = false,
  hasPlacePoints = false,
}: ResolveNexaMapSpatialStateArgs): NexaMapSpatialState {
  if (!hasRegion) return 'starting';
  if (viewportHash === 'too-large') return 'zoom-in';

  const hasAnyPoints = pointCount > 0 || hasPlacePoints;

  if (hasError || placeHasError) {
    return hasAnyPoints ? 'stale-error' : 'error';
  }

  if (loading || placeLoading) {
    return hasAnyPoints ? 'refreshing' : 'loading';
  }

  if (!hasAnyPoints && isCityScale) return 'empty';
  return 'ready';
}
