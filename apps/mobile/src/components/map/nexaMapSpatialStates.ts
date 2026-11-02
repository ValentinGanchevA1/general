export type NexaMapSpatialState =
  | 'ready'
  | 'starting'
  | 'loading'
  | 'refreshing'
  | 'empty'
  | 'error'
  | 'transient-error'
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
 * - discovery failures with no usable pins stay compact and retryable because
 *   the base map remains a valid primary surface;
 * - renderer-local Place discovery is supplementary and follows the same
 *   non-blocking recovery rule;
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

  if (hasError) {
    return hasAnyPoints ? 'stale-error' : 'transient-error';
  }

  if (placeHasError) {
    return hasAnyPoints ? 'stale-error' : 'transient-error';
  }

  if (loading || placeLoading) {
    return hasAnyPoints ? 'refreshing' : 'loading';
  }

  if (!hasAnyPoints && isCityScale) return 'empty';
  return 'ready';
}
