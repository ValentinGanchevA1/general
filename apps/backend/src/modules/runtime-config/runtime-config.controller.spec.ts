import {
  MAP_RENDERER_POLICY_CACHE_TTL_SECONDS,
  MAP_RENDERER_POLICY_VERSION,
} from '@g88/shared';

import {
  RuntimeConfigController,
  resolveMapLibreRemoteEnabled,
} from './runtime-config.controller';

describe('runtime map renderer policy', () => {
  const original = process.env.NEXA_MAPLIBRE_REMOTE_ENABLED;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.NEXA_MAPLIBRE_REMOTE_ENABLED;
    } else {
      process.env.NEXA_MAPLIBRE_REMOTE_ENABLED = original;
    }
  });

  it('enables MapLibre only for exact true', () => {
    expect(resolveMapLibreRemoteEnabled('true')).toBe(true);
  });

  it.each([undefined, '', 'false', 'TRUE', '1', ' true ', 'yes'])(
    'fails closed for %p',
    (value) => {
      expect(resolveMapLibreRemoteEnabled(value)).toBe(false);
    },
  );

  it('returns the public fail-closed policy contract', () => {
    process.env.NEXA_MAPLIBRE_REMOTE_ENABLED = 'true';

    expect(new RuntimeConfigController().getMapRendererPolicy()).toEqual({
      version: MAP_RENDERER_POLICY_VERSION,
      mapLibreEnabled: true,
      cacheTtlSeconds: MAP_RENDERER_POLICY_CACHE_TTL_SECONDS,
    });
  });

  it('defaults the endpoint to disabled when env is absent', () => {
    delete process.env.NEXA_MAPLIBRE_REMOTE_ENABLED;

    expect(new RuntimeConfigController().getMapRendererPolicy().mapLibreEnabled).toBe(false);
  });
});
