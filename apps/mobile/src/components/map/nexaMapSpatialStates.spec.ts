import { resolveNexaMapSpatialState } from './nexaMapSpatialStates';

describe('resolveNexaMapSpatialState', () => {
  const base = {
    hasRegion: true,
    loading: false,
    hasError: false,
    pointCount: 0,
    viewportHash: null,
    isCityScale: true,
  } as const;

  it('starts without implying that exact location is required', () => {
    expect(
      resolveNexaMapSpatialState({ ...base, hasRegion: false }),
    ).toBe('starting');
  });

  it('asks the user to zoom in for a viewport rejected as too large', () => {
    expect(
      resolveNexaMapSpatialState({
        ...base,
        viewportHash: 'too-large',
      }),
    ).toBe('zoom-in');
  });

  it('keeps stale points visible when a refresh fails', () => {
    expect(
      resolveNexaMapSpatialState({
        ...base,
        hasError: true,
        pointCount: 18,
      }),
    ).toBe('stale-error');
  });

  it('uses a recoverable discovery error when no prior points exist', () => {
    expect(
      resolveNexaMapSpatialState({ ...base, hasError: true }),
    ).toBe('error');
  });

  it('distinguishes first load from background refresh', () => {
    expect(
      resolveNexaMapSpatialState({ ...base, loading: true }),
    ).toBe('loading');
    expect(
      resolveNexaMapSpatialState({
        ...base,
        loading: true,
        pointCount: 12,
      }),
    ).toBe('refreshing');
  });

  it('shows empty copy only at an actionable local scale', () => {
    expect(resolveNexaMapSpatialState(base)).toBe('empty');
    expect(
      resolveNexaMapSpatialState({ ...base, isCityScale: false }),
    ).toBe('ready');
  });

  it('is ready when nearby points are available', () => {
    expect(
      resolveNexaMapSpatialState({ ...base, pointCount: 4 }),
    ).toBe('ready');
  });
});
