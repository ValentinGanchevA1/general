import type { DiscoveryPoint, EntityPoint } from '@g88/shared';

import type { NexaMarkerDensity } from './nexaEntityMarkerVisuals';

export type NexaMapZoomBand =
  | 'overview'
  | 'city'
  | 'neighborhood'
  | 'local'
  | 'nearby'
  | 'detail';

export type NexaMarkerCaptionMode = 'none' | 'selected' | 'all';

export interface NexaMapZoomPolicy {
  band: NexaMapZoomBand;
  markerDensity: NexaMarkerDensity;
  captionMode: NexaMarkerCaptionMode;
  showClusterComposition: boolean;
  maxVisiblePoints: number;
}

export const NEXA_ZOOM_HYSTERESIS = 0.18;
const MIN_DISCOVERY_ZOOM = 0;
const MAX_DISCOVERY_ZOOM = 20;

const POLICIES: Record<NexaMapZoomBand, NexaMapZoomPolicy> = {
  overview: {
    band: 'overview',
    markerDensity: 'compact',
    captionMode: 'none',
    showClusterComposition: false,
    maxVisiblePoints: 60,
  },
  city: {
    band: 'city',
    markerDensity: 'compact',
    captionMode: 'none',
    showClusterComposition: true,
    maxVisiblePoints: 90,
  },
  neighborhood: {
    band: 'neighborhood',
    markerDensity: 'compact',
    captionMode: 'none',
    showClusterComposition: true,
    maxVisiblePoints: 140,
  },
  local: {
    band: 'local',
    markerDensity: 'compact',
    captionMode: 'selected',
    showClusterComposition: true,
    maxVisiblePoints: 90,
  },
  nearby: {
    band: 'nearby',
    markerDensity: 'standard',
    captionMode: 'selected',
    showClusterComposition: true,
    maxVisiblePoints: 140,
  },
  detail: {
    band: 'detail',
    markerDensity: 'standard',
    captionMode: 'all',
    showClusterComposition: true,
    maxVisiblePoints: 180,
  },
};

export function rawZoomForLatitudeDelta(latitudeDelta: number): number {
  const safeDelta = Math.max(latitudeDelta, 0.0001);
  return Math.log2(360 / safeDelta);
}

export function initialDiscoveryZoom(rawZoom: number): number {
  return clamp(Math.floor(rawZoom), MIN_DISCOVERY_ZOOM, MAX_DISCOVERY_ZOOM);
}

/**
 * Stabilises the integer zoom sent to discovery.
 *
 * The backend switches H3 resolution at integer zoom thresholds and switches
 * clusters → entities at zoom 15. A small dead-band prevents repeated
 * cluster/entity swaps when a gesture settles close to a boundary.
 */
export function stabilizeDiscoveryZoom(
  previousZoom: number | null,
  rawZoom: number,
  hysteresis = NEXA_ZOOM_HYSTERESIS,
): number {
  const target = initialDiscoveryZoom(rawZoom);
  if (previousZoom == null) return target;

  const previous = clamp(
    Math.floor(previousZoom),
    MIN_DISCOVERY_ZOOM,
    MAX_DISCOVERY_ZOOM,
  );
  if (target === previous) return previous;

  // Large pinch jumps should not crawl through intermediate bands.
  if (Math.abs(target - previous) > 1) return target;

  if (target > previous) {
    return rawZoom >= target + hysteresis ? target : previous;
  }

  return rawZoom <= previous - hysteresis ? target : previous;
}

export function resolveNexaMapZoomPolicy(
  discoveryZoom: number,
): NexaMapZoomPolicy {
  if (discoveryZoom <= 8) return POLICIES.overview;
  if (discoveryZoom <= 11) return POLICIES.city;
  if (discoveryZoom <= 14) return POLICIES.neighborhood;
  if (discoveryZoom === 15) return POLICIES.local;
  if (discoveryZoom === 16) return POLICIES.nearby;
  return POLICIES.detail;
}

export interface MapPointPreservation {
  selectedEntityKey?: string | null;
  selectedClusterCellId?: string | null;
  ownEntityKey?: string | null;
}

/**
 * Caps native map children without losing the entity/cluster the user is
 * interacting with. Incoming server order is preserved as much as possible,
 * which keeps marker churn lower than client-side re-ranking every response.
 */
export function limitVisibleMapPoints(
  points: readonly DiscoveryPoint[],
  maxVisiblePoints: number,
  preserve: MapPointPreservation = {},
): DiscoveryPoint[] {
  if (maxVisiblePoints <= 0) return [];
  if (points.length <= maxVisiblePoints) return [...points];

  const preservedIndices = new Set<number>();
  for (let index = 0; index < points.length; index += 1) {
    if (shouldPreservePoint(points[index], preserve)) {
      preservedIndices.add(index);
    }
  }

  const chosen = new Set<number>();
  for (let index = 0; index < points.length && chosen.size < maxVisiblePoints; index += 1) {
    chosen.add(index);
  }

  for (const preservedIndex of preservedIndices) {
    if (chosen.has(preservedIndex)) continue;

    let replaceIndex = -1;
    for (let index = maxVisiblePoints - 1; index >= 0; index -= 1) {
      if (chosen.has(index) && !preservedIndices.has(index)) {
        replaceIndex = index;
        break;
      }
    }

    if (replaceIndex === -1) break;
    chosen.delete(replaceIndex);
    chosen.add(preservedIndex);
  }

  return [...chosen]
    .sort((a, b) => a - b)
    .map((index) => points[index])
    .filter((point): point is DiscoveryPoint => point != null);
}

export function entityPointKey(point: EntityPoint): string {
  return `${point.kind}:${point.id}`;
}

function shouldPreservePoint(
  point: DiscoveryPoint | undefined,
  preserve: MapPointPreservation,
): boolean {
  if (!point) return false;
  if (point.kind === 'cluster') {
    return point.cellId === preserve.selectedClusterCellId;
  }

  const key = entityPointKey(point);
  return key === preserve.selectedEntityKey || key === preserve.ownEntityKey;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
