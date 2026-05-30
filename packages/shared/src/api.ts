import type { LatLng, Viewport } from './geo';
import type { AreaCategory } from './activity';

// ─── Domain enums ──────────────────────────────────────────────────────────

export type EntityKind = 'user' | 'event' | 'listing';

export type VerificationLevel = 'none' | 'email' | 'phone' | 'selfie' | 'id';

// ─── Discovery ─────────────────────────────────────────────────────────────

export interface DiscoveryQuery {
  viewport: Viewport;
  zoom: number;
  kinds?: EntityKind[]; // default: all
  /** Hash from the previous DiscoveryResponse. Server returns a diff when provided. */
  prevViewportHash?: string;
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

/** Incremental update returned when prevViewportHash is valid and overlaps. */
export interface DiscoveryDiff {
  /** New points not present in the previous snapshot. */
  added: DiscoveryPoint[];
  /** IDs (entities) or cellIds (clusters) no longer in the viewport. */
  removed: string[];
}

export interface DiscoveryResponse {
  /**
   * Full point set. Empty when `diff` is present (diff mode).
   * Client must fall back to full replace if diff is absent.
   */
  points: DiscoveryPoint[];
  /** H3 resolution actually used (the server picks based on zoom). */
  resolution: number;
  /** Server time when the snapshot was computed. */
  generatedAt: string;
  /** Opaque hash — send as prevViewportHash on the next request. */
  viewportHash: string;
  /**
   * Present when the server computed an incremental diff against prevViewportHash.
   * Client applies added/removed on top of its cached points.
   * Null/absent means this is a full response — replace all cached points.
   */
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

// ─── Profile ───────────────────────────────────────────────────────────────

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  visibility?: 'public' | 'private';
  goals?: string[];
}

export interface UserProfile extends AuthenticatedUser {
  bio: string | null;
  visibility: 'public' | 'private';
  goals: string[];
  /** true when bio IS NOT NULL */
  profileComplete: boolean;
}

/** Public-facing profile returned by GET /users/:id */
export interface PublicUserProfile {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  verification: VerificationLevel;
  goals: string[];
  online: boolean;
}

export interface PresignedUploadResponse {
  /** Presigned S3 PUT URL — expires in 5 minutes. */
  uploadUrl: string;
  /** Final CDN URL to store as avatarUrl after the PUT succeeds. */
  publicUrl: string;
}

// ─── Chat (REST) ───────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;  // ISO
}

export interface ConversationParticipant {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ConversationSummary {
  id: string;
  participantIds: string[];
  participants: ConversationParticipant[];
  lastMessageAt: string | null;
  lastMessage: { senderId: string; body: string } | null;
}

export interface MessagePage {
  messages: ChatMessage[];
  /** Cursor for the next page (ISO timestamp of oldest message in this page). Null = no more pages. */
  nextCursor: string | null;
}

// ─── Notifications ─────────────────────────────────────────────────────────

export interface RegisterDeviceTokenRequest {
  token: string;
  platform: 'ios' | 'android';
}

// ─── Geofences ─────────────────────────────────────────────────────────────

export interface CreateGeofenceRequest {
  /** Human label, e.g. 'home' or 'work'. Defaults to 'home'. Max 50 chars. */
  label?: string;
  /** H3 r7 ring count. 0 = single cell (~5 km²), 1 = 7 cells (~35 km²). Max 3. */
  radiusRings?: number;
}

export interface GeofenceResponse {
  id: string;
  label: string;
  centerH3R7: string;
  radiusRings: number;
  /** True when the calling user's current H3 r7 cell falls within this geofence's disk. */
  inside: boolean;
  active: boolean;
  createdAt: string; // ISO
}

// ─── Alerts ────────────────────────────────────────────────────────────────

export interface CreateAlertRequest {
  category: AreaCategory;
  /** 1–280 characters. */
  body: string;
  /** Optional hashtag topic, e.g. '#open-mic'. 1–60 characters. */
  tag?: string;
}

export interface AlertResponse {
  id: string;
  category: AreaCategory;
  body: string;
  tag: string | null;
  createdAt: string; // ISO
}

// ─── Trending ──────────────────────────────────────────────────────────────

export interface TrendingResponse {
  /** Hashtag-formatted topics, e.g. ['#open-mic', '#yoga']. Up to 10 entries. */
  topics: string[];
  generatedAt: string; // ISO
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
