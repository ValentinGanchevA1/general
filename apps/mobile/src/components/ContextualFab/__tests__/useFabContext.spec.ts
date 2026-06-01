// apps/mobile/src/components/ContextualFab/__tests__/useFabContext.spec.ts
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { useFabContext, POST_ALERT_READY } from '../useFabContext';

const makeStore = (isVisible: boolean, goal = 'dating') =>
  configureStore({
    reducer: {
      profile: () => ({
        profile: { visibility: isVisible ? 'public' : 'private', goals: [goal] },
        loading: false,
        initialized: true,
        error: null,
      }),
    },
  });

const wrap = (store: ReturnType<typeof makeStore>) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    React.createElement(Provider, { store } as any, children);
  Wrapper.displayName = 'TestStoreProvider';
  return Wrapper;
};

describe('useFabContext', () => {
  it('promotes toggle_visibility when invisible (regardless of zoom)', () => {
    const { result } = renderHook(
      () => useFabContext({ zoom: 18, points: [], nearestUserId: null }),
      { wrapper: wrap(makeStore(false)) },
    );
    expect(result.current.primary).toBe('toggle_visibility');
    expect(result.current.visibility).toBe('off');
  });

  it('picks wave_nearest at near zoom when user points and nearestUserId are present', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = [{ kind: 'user', id: 'u1', lat: 0, lng: 0, meta: {} }] as any;
    const { result } = renderHook(
      () => useFabContext({ zoom: 16, points, nearestUserId: 'u1' }),
      { wrapper: wrap(makeStore(true)) },
    );
    expect(result.current.primary).toBe('wave_nearest');
    expect(result.current.zoomBand).toBe('near');
    expect(result.current.density).toBeGreaterThan(0);
  });

  it('does not pick wave_nearest when nearestUserId is null (no target)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = [{ kind: 'user', id: 'u1', lat: 0, lng: 0, meta: {} }] as any;
    const { result } = renderHook(
      () => useFabContext({ zoom: 16, points, nearestUserId: null }),
      { wrapper: wrap(makeStore(true)) },
    );
    expect(result.current.primary).not.toBe('wave_nearest');
  });

  it('counts only user-kind points for density (events and listings do not raise density)', () => {
    const points = [
      { kind: 'event', id: 'e1', lat: 0, lng: 0, meta: {} },
      { kind: 'listing', id: 'l1', lat: 0, lng: 0, meta: {} },
      { kind: 'listing', id: 'l2', lat: 0, lng: 0, meta: {} },
      { kind: 'listing', id: 'l3', lat: 0, lng: 0, meta: {} },
      { kind: 'listing', id: 'l4', lat: 0, lng: 0, meta: {} },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any;
    const { result } = renderHook(
      () => useFabContext({ zoom: 16, points, nearestUserId: null }),
      { wrapper: wrap(makeStore(true)) },
    );
    expect(result.current.density).toBe(0);
  });

  it('falls back to open_pulse while POST_ALERT_READY=false (C3 flag)', () => {
    const { result } = renderHook(
      () => useFabContext({ zoom: 8, points: [], nearestUserId: null }),
      { wrapper: wrap(makeStore(true)) },
    );
    const expected = POST_ALERT_READY ? 'post_alert' : 'open_pulse';
    expect(result.current.primary).toBe(expected);
    if (!POST_ALERT_READY) {
      expect(result.current.secondary).toContain('post_alert');
    }
  });

  it('routes trading users to create_listing at mid zoom', () => {
    const { result } = renderHook(
      () => useFabContext({ zoom: 13, points: [], nearestUserId: null }),
      { wrapper: wrap(makeStore(true, 'trading')) },
    );
    expect(result.current.primary).toBe('create_listing');
  });

  it('emits a stable context key', () => {
    const { result } = renderHook(
      () => useFabContext({ zoom: 16, points: [], nearestUserId: null }),
      { wrapper: wrap(makeStore(true, 'dating')) },
    );
    expect(result.current.key).toBe('z:near|d:0|v:on|g:dating');
  });
});
