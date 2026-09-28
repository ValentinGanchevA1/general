// Shared async data hook: loading + error + optional keep-stale on failure.
// Reports failures to Sentry so background resource errors are visible.
// Callers still own domain-specific refresh triggers (focus, events, etc.).

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Sentry from '@sentry/react-native';

export interface UseAsyncResourceOptions<T> {
  /** Stable key for Sentry tags (e.g. 'challenges.today'). */
  resourceKey: string;
  fetcher: () => Promise<T>;
  /** Seed value while first fetch is in flight / on permanent empty. */
  initialData: T;
  /** When false, skip auto-fetch on mount (caller drives refresh). Default true. */
  autoFetch?: boolean;
  /**
   * Keep previous successful data when a later fetch fails (default true).
   * error is still set so UI can show Retry without wiping the list.
   */
  keepStale?: boolean;
}

export interface AsyncResourceState<T> {
  data: T;
  loading: boolean;
  error: unknown | null;
  refresh: () => void;
}

export function useAsyncResource<T>(
  options: UseAsyncResourceOptions<T>,
): AsyncResourceState<T> {
  const {
    resourceKey,
    fetcher,
    initialData,
    autoFetch = true,
    keepStale = true,
  } = options;

  const [data, setData] = useState<T>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(() => {
    void (async () => {
      setLoading(true);
      try {
        const next = await fetcherRef.current();
        setData(next);
        setError(null);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { resource: resourceKey },
        });
        setError(err);
        if (!keepStale) {
          setData(initialData);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [resourceKey, keepStale, initialData]);

  useEffect(() => {
    if (autoFetch) refresh();
  }, [autoFetch, refresh]);

  return { data, loading, error, refresh };
}
