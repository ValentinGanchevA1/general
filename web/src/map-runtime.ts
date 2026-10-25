export type MapRenderer = 'preview-raster' | 'maplibre';
export type BasemapProvider = 'osm-preview' | 'maptiler' | 'pmtiles';

export interface MapRuntimeLocation {
  protocol: string;
  hostname: string;
}

export interface ReadyPreviewMapRuntime {
  status: 'ready';
  renderer: 'preview-raster';
  provider: 'osm-preview';
  tileTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  attribution: '© OpenStreetMap contributors';
  attributionUrl: 'https://www.openstreetmap.org/copyright';
}

export interface BlockedProductionMapRuntime {
  status: 'blocked';
  renderer: 'maplibre';
  provider: 'maptiler';
  workerUrl: '/maplibre-worker.mjs';
  reason: 'production-map-runtime-not-bundled';
}

export type NexaMapRuntime = ReadyPreviewMapRuntime | BlockedProductionMapRuntime;

export const PRODUCTION_MAP_TARGET = Object.freeze({
  renderer: 'maplibre' as const,
  provider: 'maptiler' as const,
  workerUrl: '/maplibre-worker.mjs' as const,
});

const PREVIEW_TILE_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' as const;
const PREVIEW_ATTRIBUTION = '© OpenStreetMap contributors' as const;
const PREVIEW_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright' as const;
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Resolve the browser map runtime without accepting a user-controlled tile or
 * worker host. OSM's standard raster service is intentionally limited to local
 * preview. Public origins fail closed until the pinned MapLibre runtime and an
 * approved production basemap configuration are bundled.
 */
export function resolveMapRuntime(location: MapRuntimeLocation): NexaMapRuntime {
  if (isLocalPreview(location)) {
    return {
      status: 'ready',
      renderer: 'preview-raster',
      provider: 'osm-preview',
      tileTemplate: PREVIEW_TILE_TEMPLATE,
      attribution: PREVIEW_ATTRIBUTION,
      attributionUrl: PREVIEW_ATTRIBUTION_URL,
    };
  }

  return {
    status: 'blocked',
    renderer: PRODUCTION_MAP_TARGET.renderer,
    provider: PRODUCTION_MAP_TARGET.provider,
    workerUrl: PRODUCTION_MAP_TARGET.workerUrl,
    reason: 'production-map-runtime-not-bundled',
  };
}

export function previewRasterTileUrl(
  runtime: NexaMapRuntime,
  zoom: number,
  tileX: number,
  tileY: number,
): string | null {
  if (runtime.status !== 'ready' || runtime.provider !== 'osm-preview') return null;
  if (!Number.isInteger(zoom) || !Number.isInteger(tileX) || !Number.isInteger(tileY)) return null;
  if (zoom < 0 || tileX < 0 || tileY < 0) return null;

  return runtime.tileTemplate
    .replace('{z}', String(zoom))
    .replace('{x}', String(tileX))
    .replace('{y}', String(tileY));
}

function isLocalPreview(location: MapRuntimeLocation): boolean {
  if (!LOOPBACK_HOSTS.has(location.hostname.toLowerCase())) return false;
  return location.protocol === 'http:' || location.protocol === 'https:';
}
