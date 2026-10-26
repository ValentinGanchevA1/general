import React from 'react';
import { AppState } from 'react-native';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {
  expireMapRendererPolicy,
  hydrateMapRendererPolicy,
  refreshMapRendererPolicy,
} from './mapRendererPolicySlice';

/**
 * Keep the remote renderer permission fresh only while the product map exists.
 *
 * - hydrate a still-valid local cache for startup continuity
 * - immediately revalidate against the server
 * - expire cached permission at its deadline even if the app stays foregrounded
 * - refresh on foreground so an operational kill switch is observed quickly
 * - network/malformed failures are handled fail-closed by the slice
 */
export function useMapRendererPolicyLifecycle(): void {
  const dispatch = useAppDispatch();
  const validUntilMs = useAppSelector(
    (state) => state.mapRendererPolicy.validUntilMs,
  );
  const nextRefreshAtMs = useAppSelector(
    (state) => state.mapRendererPolicy.nextRefreshAtMs,
  );
  const status = useAppSelector((state) => state.mapRendererPolicy.status);

  React.useEffect(() => {
    let active = true;

    void (async (): Promise<void> => {
      await dispatch(hydrateMapRendererPolicy());
      if (active) {
        void dispatch(refreshMapRendererPolicy());
      }
    })();

    return () => {
      active = false;
    };
  }, [dispatch]);

  React.useEffect(() => {
    if (nextRefreshAtMs <= 0) return;

    const delayMs = Math.max(0, nextRefreshAtMs - Date.now());
    const timer = setTimeout(() => {
      const nowMs = Date.now();
      if (validUntilMs > 0 && validUntilMs <= nowMs) {
        dispatch(expireMapRendererPolicy());
      }
      if (status !== 'loading') {
        void dispatch(refreshMapRendererPolicy());
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [dispatch, nextRefreshAtMs, status, validUntilMs]);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') return;

      const nowMs = Date.now();
      if (validUntilMs > 0 && validUntilMs <= nowMs) {
        dispatch(expireMapRendererPolicy());
      }
      if (status !== 'loading') {
        void dispatch(refreshMapRendererPolicy());
      }
    });

    return () => subscription.remove();
  }, [dispatch, status, validUntilMs]);
}
