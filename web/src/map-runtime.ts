export type MapRenderer = 'preview-raster' | 'maplibre';
export type BasemapProvider = 'osm-preview' | 'maptiler' | 'pmtiles';
export type MapTilerApiOrigin = 'https://api.maptiler.eu' | 'https://api.maptiler.com';

export interface MapRuntimeLocation {
  protocol: string;
  hostname: string;
}

export interface MapBuildConfig {
  maptilerApiKey: string;
  maptilerMapId: string;
  maptilerApiOrigin: MapTilerApiOrigin;
}

export interface ReadyPreviewMapRuntime {
  status: 'ready';
  renderer: 'preview-raster';
  provider: 'osm-preview';
  tileTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  attribution: '© OpenStreetMap contributors';
  attributionUrl: 'https://www.openstreetmap.org/copyright';
}

export interface ReadyProductionMapRuntime {
  status: 'ready';
  renderer: 'maplibre';
  provider: 'maptiler';
  workerUrl: '/dist/maplibre-worker.mjs';
  styleUrl: string;
  attribution: '© MapTiler © OpenStreetMap contributors';
  apiOrigin: MapTilerApiOrigin;
}

export type BlockedMapRuntimeReason =
  | 'production-map-requires-https'
  | 'production-map-provider-not-configured';

export interface BlockedProductionMapRuntime {
  status: 'blocked';
  renderer: 'maplibre';
  provider: 'maptiler';
  workerUrl: '/dist/maplibre-worker.mjs';
  reason: BlockedMapRuntimeReason;
}

export type NexaMapRuntime =
  | ReadyPreviewMapRuntime
  | ReadyProductionMapRuntime
  | BlockedProductionMapRuntime;

export const PRODUCTION_MAP_TARGET = Object.freeze({
  renderer: 'maplibre' as const,
  provider: 'maptiler' as const,
  workerUrl: '/dist/maplibre-worker.mjs' as const,
});

const PREVIEW_TILE_TEMPLATE = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png' as const;
const PREVIEW_ATTRIBUTION = '© OpenStreetMap contributors' as const;
const PREVIEW_ATTRIBUTION_URL = 'https://www.openstreetmap.org/copyright' as const;
const MAPTILER_ATTRIBUTION = '© MapTiler © OpenStreetMap contributors' as const;
const MAPTILER_EU_ORIGIN: MapTilerApiOrigin = 'https://api.maptiler.eu';
const MAPTILER_GLOBAL_ORIGIN: MapTilerApiOrigin = 'https://api.maptiler.com';
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);
const MAP_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;
const API_KEY_RE = /^[^\u0000-\u0020\u007f]{1,256}$/u;

type NexaMapConfigGlobal = typeof globalThis & {
  __NEXA_MAP_CONFIG__?: unknown;
};

/**
 * Resolve the browser map runtime without accepting a user-controlled tile,
 * style or worker host. OSM's standard raster service is loopback-preview only.
 * Public origins require HTTPS plus a validated build-generated MapTiler config.
 */
export function resolveMapRuntime(
  location: MapRuntimeLocation,
  buildConfig: unknown = readBuildConfig(),
): NexaMapRuntime {
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

  if (location.protocol !== 'https:') {
    return blockedRuntime('production-map-requires-https');
  }

  const config = validateMapBuildConfig(buildConfig);
  if (!config) return blockedRuntime('production-map-provider-not-configured');

  const styleUrl = new URL(`/maps/${config.maptilerMapId}/style.json`, config.maptilerApiOrigin);
  styleUrl.searchParams.set('key', config.maptilerApiKey);

  return {
    status: 'ready',
    renderer: PRODUCTION_MAP_TARGET.renderer,
    provider: PRODUCTION_MAP_TARGET.provider,
    workerUrl: PRODUCTION_MAP_TARGET.workerUrl,
    styleUrl: styleUrl.toString(),
    attribution: MAPTILER_ATTRIBUTION,
    apiOrigin: config.maptilerApiOrigin,
  };
}

export function validateMapBuildConfig(value: unknown): MapBuildConfig | null {
  if (!isRecord(value)) return null;

  const key = value.maptilerApiKey;
  const mapId = value.maptilerMapId;
  const apiOrigin = value.maptilerApiOrigin;

  if (typeof key !== 'string' || !API_KEY_RE.test(key)) return null;
  if (typeof mapId !== 'string' || !MAP_ID_RE.test(mapId)) return null;
  if (apiOrigin !== MAPTILER_EU_ORIGIN && apiOrigin !== MAPTILER_GLOBAL_ORIGIN) return null;

  return {
    maptilerApiKey: key,
    maptilerMapId: mapId,
    maptilerApiOrigin: apiOrigin,
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

function readBuildConfig(): unknown {
  return (globalThis as NexaMapConfigGlobal).__NEXA_MAP_CONFIG__;
}

function blockedRuntime(reason: BlockedMapRuntimeReason): BlockedProductionMapRuntime {
  return {
    status: 'blocked',
    renderer: PRODUCTION_MAP_TARGET.renderer,
    provider: PRODUCTION_MAP_TARGET.provider,
    workerUrl: PRODUCTION_MAP_TARGET.workerUrl,
    reason,
  };
}

function isLocalPreview(location: MapRuntimeLocation): boolean {
  if (!LOOPBACK_HOSTS.has(location.hostname.toLowerCase())) return false;
  return location.protocol === 'http:' || location.protocol === 'https:';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
