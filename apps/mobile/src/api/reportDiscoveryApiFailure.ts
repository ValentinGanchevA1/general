import { track } from '@/lib/analytics';
import {
  classifyDiscoveryFailure,
  type DiscoveryFailureLane,
} from '@/features/discovery/discoveryFailureDiagnostics';

function discoveryLaneForUrl(url: string | undefined): DiscoveryFailureLane | null {
  if (url == null) return null;
  const path = url.split('?')[0] ?? '';
  if (path.endsWith('/discovery/nearby')) return 'legacy';
  if (path.endsWith('/discovery/places')) return 'places';
  return null;
}

/**
 * Records only coarse discovery failure metadata as a Sentry breadcrumb.
 * `track()` does not upload arbitrary events to first-party product analytics.
 */
export function reportDiscoveryApiFailure(
  url: string | undefined,
  error: unknown,
  cancelled = false,
): void {
  const lane = discoveryLaneForUrl(url);
  if (lane == null) return;

  const diagnostic = classifyDiscoveryFailure(lane, error, cancelled);
  if (diagnostic.kind === 'cancelled') return;

  track('map_discovery_failure', {
    lane: diagnostic.lane,
    failureKind: diagnostic.kind,
    statusCode: diagnostic.statusCode,
    retryable: diagnostic.retryable,
  });
}
