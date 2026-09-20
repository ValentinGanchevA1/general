import type { LatLng, Viewport } from './geo';
import type { AreaCategory } from './activity';
import type { ListingMode } from './listing';

// ─── Domain enums ──────────────────────────────────────────────────────────

export type EntityKind = 'user' | 'event' | 'listing';

export type VerificationLevel = 'none' | 'email' | 'phone' | 'selfie' | 'id';

/** Server-side map discovery sort. Default relevance. */
export type DiscoveryRankBy = 'relevance' | 'distance' | 'newest';

// ─── Discovery ─────────────────────────────────────────────────────────────

export interface DiscoveryQuery {
  viewport: Viewport;
  zoom: number;
  kinds?: EntityKind[];
  prevViewportHash?: string;
  topic?: string;
  listingMode?: ListingMode;
  friendsOnly?: boolean;
  rankBy?: DiscoveryRankBy;
}

export interface ClusterPoint {
  kind: 'cluster';
  cellId: string;
  lat: number;
  lng: number;
  count: number;
  by: Partial<Record<EntityKind, number>>;
}

export type EntityPoint =
  | (EntityBase & { kind: 'user'; meta: UserMeta })
  | (EntityBase & { kind: 'event'; meta: EventMeta })
  | (EntityBase & { kind: 'listing'; meta: ListingMeta });

interface EntityBase {
  id: string;
  lat: number;
  lng: number;
  rankScore?: number;
}

export interface UserMeta {
  displayName: string;
  avatarUrl: string | null;
  verification: VerificationLevel;
  online: boolean;
  lastSeenAt: string | null;
  verifiedBadge?: boolean;
  isFriend?: boolean;
}

export interface EventMeta {
  title: string;
  coverUrl: string | null;
  startsAt: string;
  attendeeCount: number;
  capacity: number | null;
  hostId?: string;
  hostDisplayName?: string;
}

export interface ListingMeta {
  title: string;
  thumbnailUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  mode?: ListingMode;
  sellerId?: string;
  sellerDisplayName?: string;
  createdAt?: string;
}

export type DiscoveryPoint = ClusterPoint | EntityPoint;

export interface DiscoveryDiff {
  added: DiscoveryPoint[];
  removed: string[];
}

export interface DiscoveryResponse {
  points: DiscoveryPoint[];
  resolution: number;
  generatedAt: string;
  viewportHash: string;
  diff?: DiscoveryDiff | null;
}

// ─── Interactions ──────────────────────────────────────────────────────────

export interface WaveRequest {
  toUserId: string;
  context?: 'map' | 'profile' | 'event';
}

export interface WaveResponse {
  id: string;
  fromUserId: string;
  toUserId: string;
  createdAt: string;
  conversationId: string | null;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  email: string;
  verification: VerificationLevel;
  avatarUrl: string | null;
}

export interface LoginResponse {
  user: AuthenticatedUser;
  tokens: AuthTokens;
}

// ─── Profile ───────────────────────────────────────────────────────────────

export type SubscriptionTier = 'free' | 'basic' | 'premium';
export type SocialProvider =
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'facebook'
  | 'linkedin'
  | 'spotify';

export interface SocialLink {
  provider: SocialProvider;
  username: string | null;
  url: string | null;
  verified: boolean;
}

export interface ProfileBadges {
  email: boolean;
  phone: boolean;
  photo: boolean;
  id: boolean;
  social: boolean;
  premium: boolean;
  verified: boolean;
}

// ─── Error envelope ────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

// Re-export
export type { LatLng, Viewport };
