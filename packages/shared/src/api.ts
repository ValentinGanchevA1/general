import type { LatLng, Viewport } from './geo';

// ─── Domain enums ──────────────────────────────────────────────────────────

export type EntityKind = 'user' | 'event' | 'listing';

export type VerificationLevel = 'none' | 'email' | 'phone' | 'selfie' | 'id';

// ─── Discovery ─────────────────────────────────────────────────────────────

export interface DiscoveryQuery {
  viewport: Viewport;
  zoom: number;
  kinds?: EntityKind[]; // default: all
}

/** A cluster bubble — one H3 cell aggregating N entities. */
export interface ClusterPoint {
  kind: 'cluster';
  cellId: string;       // H3 cell id, stable for client-side dedupe
  lat: number;          // cell centroid
  lng: number;
  count: number;        // total entities in cell
  /** Breakdown by entity kind for icon tinting. */
  by: Partial<Record<EntityKind, number>>;
}

/** A single discoverable entity. Meta is a discriminated union by kind. */
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
  lastSeenAt: string | null; // ISO
}

export interface EventMeta {
  title: string;
  coverUrl: string | null;
  startsAt: string;          // ISO
  attendeeCount: number;
  capacity: number | null;
}

export interface ListingMeta {
  title: string;
  thumbnailUrl: string | null;
  priceCents: number;
  currency: string;          // ISO 4217
  category: string;
}

export type DiscoveryPoint = ClusterPoint | EntityPoint;

export interface DiscoveryResponse {
  points: DiscoveryPoint[];
  /** H3 resolution actually used (the server picks based on zoom). */
  resolution: number;
  /** Server time when the snapshot was computed. */
  generatedAt: string;
  /** Opaque hash for the viewport-diff protocol (Phase 1.5). */
  viewportHash: string;
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
  /** Set if this wave reciprocates an existing one and a chat was opened. */
  conversationId: string | null;
}

// ─── Auth ──────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;       // JWT, ~15min
  refreshToken: string;      // opaque, ~30d, rotating
  expiresAt: string;         // ISO, access token expiry
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

// ─── Error envelope ────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  code: string;              // machine-readable, e.g. 'wave.rate_limited'
  message: string;           // human-readable
  details?: Record<string, unknown>;
}

// Re-export
export type { LatLng, Viewport };
