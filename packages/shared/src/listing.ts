// packages/shared/src/listing.ts
//
// P3.7 trading — domain DTOs shared between backend and mobile (offer-based
// marketplace v1; no payment processing — Stripe Connect is P4-deferred).
// (api.ts already exports ListingMeta for the map/discovery view; this file is
//  the trading *feature* — listings CRUD, offers, favorites.)

import type { LatLng } from './geo';

export const LISTING_STATUSES = ['active', 'sold', 'withdrawn'] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_VISIBILITIES = ['public', 'private'] as const;
export type ListingVisibility = (typeof LISTING_VISIBILITIES)[number];

export const OFFER_STATUSES = ['pending', 'accepted', 'declined', 'withdrawn'] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const LISTING_LIMITS = {
  titleMax: 120,
  descriptionMax: 2000,
  categoryMax: 40,
  priceCentsMax: 100_000_000, // $1,000,000 cap
  offerMessageMax: 500,
} as const;

// ─── Create / read ────────────────────────────────────────────────────────────

export interface CreateListingRequest {
  title: string;
  description?: string;
  thumbnailUrl?: string;
  priceCents: number;
  currency?: string; // ISO 4217, default USD
  category: string;
  /** Where the item is — a seller-published location (stored precisely). */
  location: LatLng;
  visibility?: ListingVisibility;
}

/** Base64-over-JSON listing image upload (same RN-safe path as gallery photos). */
export interface UploadListingImageRequest {
  /** Raw base64 (no data-URI prefix). */
  data: string;
  /** image/jpeg · image/png · image/webp · image/heic. */
  contentType: string;
}

export interface UploadListingImageResponse {
  /** Public S3 URL — pass as `thumbnailUrl` when creating the listing. */
  url: string;
}

/** Compact listing for the browse grid. */
export interface ListingSummary {
  id: string;
  sellerId: string;
  title: string;
  thumbnailUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  status: ListingStatus;
  location: LatLng;
  createdAt: string;
  /** Whether the calling user has saved this listing. */
  favoritedByMe: boolean;
}

/** Full listing detail (listing screen). */
export interface ListingDetail extends ListingSummary {
  description: string | null;
  visibility: ListingVisibility;
  sellerDisplayName: string;
  sellerAvatarUrl: string | null;
  favoriteCount: number;
  /** The caller's own offer on this listing, if any. */
  myOffer: ListingOffer | null;
  /** Open offer count — visible to the seller only (0 for non-sellers). */
  offerCount: number;
}

export interface BrowseListingsRequest {
  location: LatLng;
  radiusM?: number;
  category?: string;
  limit?: number;
}

export interface UpdateListingStatusRequest {
  status: ListingStatus;
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export interface MakeOfferRequest {
  /** Proposed price in cents; omit to express interest at the asking price. */
  offerCents?: number;
  message?: string;
}

export interface ListingOffer {
  id: string;
  listingId: string;
  buyerId: string;
  buyerDisplayName: string;
  buyerAvatarUrl: string | null;
  offerCents: number | null;
  message: string | null;
  status: OfferStatus;
  createdAt: string;
}

export interface RespondToOfferRequest {
  /** Seller decision. */
  status: Extract<OfferStatus, 'accepted' | 'declined'>;
}

// ─── Favorites ──────────────────────────────────────────────────────────────

export interface ToggleFavoriteResponse {
  listingId: string;
  favorited: boolean;
  favoriteCount: number;
}
