import type { LatLng } from './geo';
import type { CreateListingRequest, ListingSummary } from './listing';

export const MARKETPLACE_KINDS = ['for_sale', 'service', 'job', 'local_deal'] as const;
export type MarketplaceKind = (typeof MARKETPLACE_KINDS)[number];

export const MARKETPLACE_LIMITS = {
  searchMax: 80,
} as const;

/** Marketplace card DTO. Generic listing/offers remain compatible through ListingSummary. */
export interface MarketplaceListingSummary extends ListingSummary {
  marketplaceKind: MarketplaceKind;
}

/** Nearby, kind-specific Marketplace browse request. */
export interface BrowseMarketplaceRequest {
  location: LatLng;
  radiusM?: number;
  marketplaceKind: MarketplaceKind;
  query?: string;
  limit?: number;
}

/** Sell-side Marketplace creation. Wanted/buy posts continue to use CreateListingRequest. */
export type CreateMarketplaceListingRequest = Omit<CreateListingRequest, 'mode'> & {
  marketplaceKind: MarketplaceKind;
};
