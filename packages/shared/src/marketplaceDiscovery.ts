import type { DiscoveryQuery, ListingMeta } from './api';
import type { MarketplaceKind } from './marketplace';

/** Optional sell-side Marketplace taxonomy filter for map discovery. */
export interface MarketplaceDiscoveryFilter {
  marketplaceKind?: MarketplaceKind;
}

/**
 * Backward-compatible discovery request extension used by mobile + backend.
 * `listingMode=buy` (Wanted) and `marketplaceKind` are intentionally mutually
 * exclusive in product state; backend normalization remains authoritative.
 */
export type MarketplaceDiscoveryQuery = DiscoveryQuery & MarketplaceDiscoveryFilter;

/** Realtime subscription uses the same active filter context, without the HTTP diff cursor. */
export type MarketplaceDiscoverySubscriptionPayload = Omit<
  MarketplaceDiscoveryQuery,
  'prevViewportHash'
>;

/** Listing discovery metadata after the first-class Marketplace taxonomy migration. */
export type MarketplaceListingMeta = ListingMeta & {
  marketplaceKind?: MarketplaceKind;
};
