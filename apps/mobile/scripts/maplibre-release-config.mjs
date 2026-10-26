const MAP_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/u;
const API_KEY_RE = /^[^\u0000-\u0020\u007f]{1,256}$/u;
const ALLOWED_REGIONS = new Set(['eu', 'global']);

export function readMapLibreReleaseConfig(env = process.env) {
  return {
    apiKey: env.NEXA_MAPTILER_API_KEY ?? '',
    mapId: env.NEXA_MAPTILER_MAP_ID || 'streets-v4',
    region: env.NEXA_MAPTILER_REGION || 'eu',
  };
}

export function validateMapLibreReleaseConfig(config) {
  const {apiKey, mapId, region} = config;

  if (apiKey.trim().length === 0) {
    return {
      ok: false,
      reason: 'NEXA_MAPTILER_API_KEY is required for release builds',
    };
  }

  if (!API_KEY_RE.test(apiKey)) {
    return {
      ok: false,
      reason:
        'NEXA_MAPTILER_API_KEY contains whitespace/control characters or exceeds 256 characters',
    };
  }

  if (!MAP_ID_RE.test(mapId)) {
    return {
      ok: false,
      reason: 'NEXA_MAPTILER_MAP_ID must be a simple MapTiler map identifier',
    };
  }

  if (!ALLOWED_REGIONS.has(region)) {
    return {
      ok: false,
      reason: 'NEXA_MAPTILER_REGION must be either eu or global',
    };
  }

  return {ok: true, mapId, region};
}
