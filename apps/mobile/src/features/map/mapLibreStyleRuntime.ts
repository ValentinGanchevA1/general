export type MapTilerRegion = 'eu' | 'global';

export interface MapLibreStyleEnvironment {
  apiKey: string;
  mapId: string;
  region: string;
}

export type MapLibreStyleBlockedReason =
  | 'map-provider-not-configured'
  | 'map-provider-invalid';

export interface ReadyMapLibreStyleRuntime {
  status: 'ready';
  provider: 'maptiler';
  styleUrl: string;
  attribution: '© MapTiler © OpenStreetMap contributors';
}

export interface BlockedMapLibreStyleRuntime {
  status: 'blocked';
  provider: 'maptiler';
  reason: MapLibreStyleBlockedReason;
}

export type MapLibreStyleRuntime =
  | ReadyMapLibreStyleRuntime
  | BlockedMapLibreStyleRuntime;

const MAPTILER_EU_ORIGIN = 'https://api.maptiler.eu';
const MAPTILER_GLOBAL_ORIGIN = 'https://api.maptiler.com';
const MAPTILER_ATTRIBUTION = '© MapTiler © OpenStreetMap contributors' as const;
const MAP_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;
const API_KEY_RE = /^[^\u0000-\u0020\u007f]{1,256}$/u;

/**
 * Resolve a production MapLibre style without accepting arbitrary provider URLs.
 * Missing or malformed build-time config fails closed; no demo/OSM fallback is
 * allowed on the production native renderer path.
 */
export function resolveMapLibreStyleRuntime(
  environment: MapLibreStyleEnvironment,
): MapLibreStyleRuntime {
  const apiKey = environment.apiKey.trim();
  if (apiKey.length === 0) {
    return blockedRuntime('map-provider-not-configured');
  }

  if (!API_KEY_RE.test(environment.apiKey)) {
    return blockedRuntime('map-provider-invalid');
  }

  if (!MAP_ID_RE.test(environment.mapId)) {
    return blockedRuntime('map-provider-invalid');
  }

  const origin = resolveMapTilerOrigin(environment.region);
  if (origin === null) {
    return blockedRuntime('map-provider-invalid');
  }

  const styleUrl = `${origin}/maps/${environment.mapId}/style.json?key=${encodeURIComponent(
    environment.apiKey,
  )}`;

  return {
    status: 'ready',
    provider: 'maptiler',
    styleUrl,
    attribution: MAPTILER_ATTRIBUTION,
  };
}

function resolveMapTilerOrigin(region: string): string | null {
  if (region === 'eu') return MAPTILER_EU_ORIGIN;
  if (region === 'global') return MAPTILER_GLOBAL_ORIGIN;
  return null;
}

function blockedRuntime(
  reason: MapLibreStyleBlockedReason,
): BlockedMapLibreStyleRuntime {
  return {
    status: 'blocked',
    provider: 'maptiler',
    reason,
  };
}
