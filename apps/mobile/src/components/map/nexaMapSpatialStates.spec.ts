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

  it('treats visible Place points as stale content when legacy discovery fails', () => {
    expect(
      resolveNexaMapSpatialState({
        ...base,
        hasError: true,
        hasPlacePoints: true,
      }),
    ).toBe('stale-error');
  });

  it('keeps a no-point legacy discovery failure compact and retryable', () => {
    expect(
      resolveNexaMapSpatialState({ ...base, hasError: true }),
    ).toBe('transient-error');
  });

  it('keeps a no-point Place-only discovery failure compact and retryable', () => {
    expect(
      resolveNexaMapSpatialState({ ...base, placeHasError: true }),
    ).toBe('transient-error');
  });

  it('keeps visible content when Place discovery refresh fails', () => {
    expect(
      resolveNexaMapSpatialState({
        ...base,
        placeHasError: true,
        hasPlacePoints: true,
      }),
    ).toBe('stale-error');
    expect(
      resolveNexaMapSpatialState({
        ...base,
        placeHasError: true,
        pointCount: 4,
      }),
    ).toBe('stale-error');
  });

  it('keeps simultaneous no-point discovery lane failures non-blocking and retryable', () => {
    expect(
      resolveNexaMapSpatialState({
        ...base,
        hasError: true,
        placeHasError: true,
      }),
    ).toBe('transient-error');
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

  it('treats Place discovery as part of the same map loading surface', () => {
    expect(
      resolveNexaMapSpatialState({ ...base, placeLoading: true }),
    ).toBe('loading');
    expect(
      resolveNexaMapSpatialState({
        ...base,
        placeLoading: true,
        hasPlacePoints: true,
      }),
    ).toBe('refreshing');
  });

  it('shows empty copy only at an actionable local scale', () => {
    expect(resolveNexaMapSpatialState(base)).toBe('empty');
    expect(
      resolveNexaMapSpatialState({ ...base, isCityScale: false }),
    ).toBe('ready');
  });

  it('does not show empty copy while a Place point is visible', () => {
    expect(
      resolveNexaMapSpatialState({ ...base, hasPlacePoints: true }),
    ).toBe('ready');
  });

  it('is ready when nearby points are available', () => {
    expect(
      resolveNexaMapSpatialState({ ...base, pointCount: 4 }),
    ).toBe('ready');
  });
});
