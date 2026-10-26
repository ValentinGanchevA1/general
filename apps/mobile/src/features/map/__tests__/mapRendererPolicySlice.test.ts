import {
  MAP_RENDERER_POLICY_CACHE_TTL_SECONDS,
  MAP_RENDERER_POLICY_VERSION,
} from '@g88/shared';

import reducer, {
  createCachedMapRendererPolicy,
  expireMapRendererPolicy,
  initialMapRendererPolicyState,
  parseCachedMapRendererPolicy,
  parseMapRendererPolicy,
  refreshMapRendererPolicy,
} from '../mapRendererPolicySlice';

describe('map renderer policy runtime', () => {
  it('accepts only a valid bounded server policy', () => {
    expect(
      parseMapRendererPolicy({
        version: MAP_RENDERER_POLICY_VERSION,
        mapLibreEnabled: true,
        cacheTtlSeconds: MAP_RENDERER_POLICY_CACHE_TTL_SECONDS,
      }),
    ).toEqual({
      version: MAP_RENDERER_POLICY_VERSION,
      mapLibreEnabled: true,
      cacheTtlSeconds: MAP_RENDERER_POLICY_CACHE_TTL_SECONDS,
    });

    expect(
      parseMapRendererPolicy({
        version: MAP_RENDERER_POLICY_VERSION,
        mapLibreEnabled: false,
        cacheTtlSeconds: 1,
      }),
    ).not.toBeNull();
  });

  it.each([
    null,
    {},
    { version: 2, mapLibreEnabled: true, cacheTtlSeconds: 60 },
    { version: 1, mapLibreEnabled: 'true', cacheTtlSeconds: 60 },
    { version: 1, mapLibreEnabled: true, cacheTtlSeconds: 0 },
    { version: 1, mapLibreEnabled: true, cacheTtlSeconds: 60.5 },
    {
      version: 1,
      mapLibreEnabled: true,
      cacheTtlSeconds: MAP_RENDERER_POLICY_CACHE_TTL_SECONDS + 1,
    },
  ])('fails closed for malformed server policy %#', (value) => {
    expect(parseMapRendererPolicy(value)).toBeNull();
  });

  it('bounds cached enable permission to the server TTL', () => {
    const nowMs = 1_000_000;
    const policy = parseMapRendererPolicy({
      version: MAP_RENDERER_POLICY_VERSION,
      mapLibreEnabled: true,
      cacheTtlSeconds: 30,
    });
    if (policy === null) throw new Error('Expected a valid test policy');

    const cached = createCachedMapRendererPolicy(policy, nowMs);
    expect(cached.expiresAtMs).toBe(nowMs + 30_000);
    expect(parseCachedMapRendererPolicy(cached, nowMs + 29_999)).toEqual(cached);
    expect(parseCachedMapRendererPolicy(cached, nowMs + 30_000)).toBeNull();
  });

  it('rejects cached permissions whose stored duration exceeds the client maximum', () => {
    const nowMs = 1_000_000;
    expect(
      parseCachedMapRendererPolicy(
        {
          version: MAP_RENDERER_POLICY_VERSION,
          mapLibreEnabled: true,
          savedAtMs: nowMs,
          expiresAtMs:
            nowMs + (MAP_RENDERER_POLICY_CACHE_TTL_SECONDS + 1) * 1_000,
        },
        nowMs,
      ),
    ).toBeNull();
  });

  it('expires an active MapLibre permission immediately', () => {
    const state = reducer(
      {
        ...initialMapRendererPolicyState,
        mapLibreEnabled: true,
        validUntilMs: 123_000,
        nextRefreshAtMs: 123_000,
        status: 'ready',
        source: 'network',
      },
      expireMapRendererPolicy(),
    );

    expect(state.mapLibreEnabled).toBe(false);
    expect(state.validUntilMs).toBe(0);
    expect(state.source).toBe('default');
  });

  it('surfaces refresh failure in Redux and fails closed', () => {
    const state = reducer(
      {
        ...initialMapRendererPolicyState,
        mapLibreEnabled: true,
        validUntilMs: 123_000,
        nextRefreshAtMs: 123_000,
        status: 'ready',
        source: 'network',
      },
      {
        type: refreshMapRendererPolicy.rejected.type,
        payload: { code: 'unavailable', retryAtMs: 456_000 },
      },
    );

    expect(state.mapLibreEnabled).toBe(false);
    expect(state.validUntilMs).toBe(0);
    expect(state.nextRefreshAtMs).toBe(456_000);
    expect(state.status).toBe('error');
    expect(state.error).toBe('unavailable');
  });
});
