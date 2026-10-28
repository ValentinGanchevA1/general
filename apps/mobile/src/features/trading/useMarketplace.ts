import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as Sentry from '@sentry/react-native';

import type {
  BrowseMarketplaceRequest,
  CreateMarketplaceListingRequest,
  LatLng,
  MarketplaceKind,
  MarketplaceListingSummary,
} from '@g88/shared';
import { postJson } from '@/api/client';

interface UseMarketplaceBrowseResult {
  listings: MarketplaceListingSummary[];
  loading: boolean;
  error: unknown | null;
  refresh: () => void;
}

export function useBrowseMarketplace(
  location: LatLng | null,
  options: {
    marketplaceKind: MarketplaceKind;
    query?: string;
  },
): UseMarketplaceBrowseResult {
  const marketplaceKind = options.marketplaceKind;
  const query = options.query?.trim() || undefined;
  const [listings, setListings] = useState<MarketplaceListingSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(() => {
    if (!location) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    void (async () => {
      setLoading(true);
      try {
        const body: BrowseMarketplaceRequest = {
          location,
          marketplaceKind,
          ...(query ? { query } : {}),
        };
        const next = await postJson<BrowseMarketplaceRequest, MarketplaceListingSummary[]>(
          '/marketplace/browse',
          body,
          { signal: ctrl.signal },
        );
        if (ctrl.signal.aborted) return;
        setListings(next);
        setError(null);
      } catch (err) {
        if (axios.isCancel(err) || ctrl.signal.aborted) return;
        Sentry.captureException(err, { tags: { resource: 'marketplace.browse' } });
        setError(err);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    })();
  }, [location?.lat, location?.lng, marketplaceKind, query]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { listings, loading, error, refresh };
}

export function createMarketplaceListing(
  request: CreateMarketplaceListingRequest,
): Promise<MarketplaceListingSummary> {
  return postJson<CreateMarketplaceListingRequest, MarketplaceListingSummary>('/marketplace', request);
}
