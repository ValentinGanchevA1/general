// apps/mobile/src/features/trading/useTrading.ts
//
// Data layer for the P3.7 trading surface. Mirrors useEvents: useState + refresh
// hooks for reads, plain async helpers for writes (screens refresh after).
// Wraps the /listings REST API (offer-based v1, no payment processing).

import { useCallback, useEffect, useState } from 'react';

import type {
  BrowseListingsRequest,
  CreateListingRequest,
  LatLng,
  ListingDetail,
  ListingOffer,
  ListingStatus,
  ListingSummary,
  MakeOfferRequest,
  ToggleFavoriteResponse,
} from '@g88/shared';
import { getJson, postJson, putJson } from '@/api/client';

// ─── Browse grid ──────────────────────────────────────────────────────────────

interface UseBrowseResult {
  listings: ListingSummary[];
  loading: boolean;
  refresh: () => void;
}

export function useBrowseListings(
  location: LatLng | null,
  category?: string | null,
): UseBrowseResult {
  const [listings, setListings] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!location) return;
    void (async () => {
      setLoading(true);
      try {
        const body: BrowseListingsRequest = {
          location,
          ...(category ? { category } : {}),
        };
        setListings(await postJson<BrowseListingsRequest, ListingSummary[]>('/listings/browse', body));
      } catch {
        // keep stale data on error
      } finally {
        setLoading(false);
      }
    })();
  }, [location?.lat, location?.lng, category]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh(); }, [refresh]);

  return { listings, loading, refresh };
}

// ─── Single listing (detail + offers) ─────────────────────────────────────────

interface UseListingResult {
  listing: ListingDetail | null;
  offers: ListingOffer[];
  loading: boolean;
  refresh: () => void;
  refreshOffers: () => void;
}

export function useListing(listingId: string): UseListingResult {
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [offers, setOffers] = useState<ListingOffer[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshOffers = useCallback(() => {
    void (async () => {
      try {
        setOffers(await getJson<ListingOffer[]>(`/listings/${listingId}/offers`));
      } catch {
        /* keep stale */
      }
    })();
  }, [listingId]);

  const refresh = useCallback(() => {
    void (async () => {
      setLoading(true);
      try {
        setListing(await getJson<ListingDetail>(`/listings/${listingId}`));
      } catch {
        /* keep stale */
      } finally {
        setLoading(false);
      }
    })();
    refreshOffers();
  }, [listingId, refreshOffers]);

  useEffect(() => { refresh(); }, [refresh]);

  return { listing, offers, loading, refresh, refreshOffers };
}

// ─── My saved listings ────────────────────────────────────────────────────────

export function useFavorites(
  enabled = true,
): { favorites: ListingSummary[]; loading: boolean; refresh: () => void } {
  const [favorites, setFavorites] = useState<ListingSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!enabled) return;
    void (async () => {
      setLoading(true);
      try {
        setFavorites(await getJson<ListingSummary[]>('/listings/favorites'));
      } catch {
        /* keep stale */
      } finally {
        setLoading(false);
      }
    })();
  }, [enabled]);

  useEffect(() => { refresh(); }, [refresh]);

  return { favorites, loading, refresh };
}

// ─── Mutations ──────────────────────────────────────────────────────────────

export function createListing(req: CreateListingRequest): Promise<ListingSummary> {
  return postJson<CreateListingRequest, ListingSummary>('/listings', req);
}

export function toggleFavorite(listingId: string): Promise<ToggleFavoriteResponse> {
  return putJson<Record<string, never>, ToggleFavoriteResponse>(`/listings/${listingId}/favorite`, {});
}

export function makeOffer(listingId: string, req: MakeOfferRequest): Promise<ListingOffer> {
  return postJson<MakeOfferRequest, ListingOffer>(`/listings/${listingId}/offers`, req);
}

export function withdrawOffer(listingId: string): Promise<ListingOffer> {
  return putJson<Record<string, never>, ListingOffer>(`/listings/${listingId}/offer/withdraw`, {});
}

export function respondToOffer(offerId: string, status: 'accepted' | 'declined'): Promise<ListingOffer> {
  return putJson<{ status: 'accepted' | 'declined' }, ListingOffer>(`/listings/offers/${offerId}`, { status });
}

export function updateListingStatus(listingId: string, status: ListingStatus): Promise<ListingDetail> {
  return putJson<{ status: ListingStatus }, ListingDetail>(`/listings/${listingId}/status`, { status });
}
