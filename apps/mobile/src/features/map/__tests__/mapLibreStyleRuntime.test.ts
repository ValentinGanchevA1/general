import { resolveMapLibreStyleRuntime } from '../mapLibreStyleRuntime';

describe('resolveMapLibreStyleRuntime', () => {
  it('fails closed when the MapTiler key is missing', () => {
    expect(
      resolveMapLibreStyleRuntime({
        apiKey: '',
        mapId: 'streets-v4',
        region: 'eu',
      }),
    ).toEqual({
      status: 'blocked',
      provider: 'maptiler',
      reason: 'map-provider-not-configured',
    });
  });

  it('rejects malformed map identifiers', () => {
    expect(
      resolveMapLibreStyleRuntime({
        apiKey: 'public-key',
        mapId: '../unsafe-style',
        region: 'eu',
      }),
    ).toEqual({
      status: 'blocked',
      provider: 'maptiler',
      reason: 'map-provider-invalid',
    });
  });

  it('rejects unsupported provider regions', () => {
    expect(
      resolveMapLibreStyleRuntime({
        apiKey: 'public-key',
        mapId: 'streets-v4',
        region: 'custom-origin',
      }),
    ).toEqual({
      status: 'blocked',
      provider: 'maptiler',
      reason: 'map-provider-invalid',
    });
  });

  it('builds the EU MapTiler style URL from validated config', () => {
    expect(
      resolveMapLibreStyleRuntime({
        apiKey: 'public-key',
        mapId: 'streets-v4',
        region: 'eu',
      }),
    ).toEqual({
      status: 'ready',
      provider: 'maptiler',
      styleUrl:
        'https://api.maptiler.eu/maps/streets-v4/style.json?key=public-key',
      attribution: '© MapTiler © OpenStreetMap contributors',
    });
  });

  it('supports the allowlisted global MapTiler API origin', () => {
    const runtime = resolveMapLibreStyleRuntime({
      apiKey: 'public-key',
      mapId: 'streets-v4',
      region: 'global',
    });

    expect(runtime.status).toBe('ready');
    if (runtime.status === 'ready') {
      expect(runtime.styleUrl).toBe(
        'https://api.maptiler.com/maps/streets-v4/style.json?key=public-key',
      );
    }
  });
});
