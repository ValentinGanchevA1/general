import type { LatLng, Viewport } from './geo';
import type { AreaCategory } from './activity';
import type { ListingMode } from './listing';

// ─── Domain enums ──────────────────────────────────────────────────────────

export type EntityKind = 'user' | 'event' | 'listing';

export type VerificationLevel = 'none' | 'email' | 'phone' | 'selfie' | 'id';

// ─── Discovery ─────────────────────────────────────────────────────────────

export interface DiscoveryQuery {
  viewport: Viewport;
  zoom: number;
  kinds?: EntityKind[];
  prevViewportHash?: string;
  topic?: string;
  /**
   * When set, only listings matching this mode are returned.
   * Users and events are unaffected. Omit for all listings.
   */
  listingMode?: ListingMode;
  /**
   * When true, only close-friend user pins are returned (events/listings omitted).
   * Offline friends remain visible; online is still presence-based.
   */
  friendsOnly?: boolean;
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
}

export interface UserMeta {
  displayName: string;
  avatarUrl: string | null;
  verification: VerificationLevel;
  online: boolean;
  lastSeenAt: string | null;
  verifiedBadge?: boolean;
  /** True when viewer and this user are close friends (map tier styling). */
  isFriend?: boolean;
}

export interface EventMeta {
  title: string;
  coverUrl: string | null;
  startsAt: string;
  attendeeCount: number;
  capacity: number | null;
}

export interface ListingMeta {
  title: string;
  thumbnailUrl: string | null;
  priceCents: number;
  currency: string;
  category: string;
  /** sell (default) | buy (wanted). Omitted on legacy rows → treat as sell. */
  mode?: ListingMode;
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
