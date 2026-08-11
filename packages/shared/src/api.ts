import type { LatLng, Viewport } from './geo';
import type { AreaCategory } from './activity';

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

export interface UpdateProfileRequest {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  visibility?: 'public' | 'private';
  goals?: string[];
  interests?: string[];
  dateOfBirth?: string | null;
}

export type IdVerificationStatus = 'none' | 'pending' | 'verified' | 'rejected';

export interface UserProfile extends AuthenticatedUser {
  bio: string | null;
  visibility: 'public' | 'private';
  goals: string[];
  interests: string[];
  profileComplete: boolean;
  phone: string | null;
  age: number | null;
  photoUrls: string[];
  subscriptionTier: SubscriptionTier;
  socialLinks: SocialLink[];
  verificationScore: number;
  badges: ProfileBadges;
  idVerificationStatus: IdVerificationStatus;
  verifiedBadge: boolean;
  createdAt: string;
}

/** Public status shown only inside EntityBottomSheet / profile (not on map markers). */
export interface PublicUserStatus {
  level: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  currentStreak: number;
}

/** Public-facing profile returned by GET /users/:id */
export interface PublicUserProfile {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  verification: VerificationLevel;
  verificationScore: number;
  idVerified: boolean;
  goals: string[];
  online: boolean;
  /**
   * Ordered gallery URLs for the public profile photo album.
   * Omitted or empty when the user has no gallery photos.
   */
  photoUrls?: string[];
  status?: PublicUserStatus;
  relationship?: ProfileRelationship;
  blockedByViewer?: boolean;
}

export interface BlockedUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  blockedAt: string;
}

export type MessagePermission = 'chat' | 'request' | 'none';

export interface ProfileRelationship {
  matched: boolean;
  sharedInterests: string[];
  canMessage: MessagePermission;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  publicUrl: string;
}

// ─── Gallery photos ──────────────────────────────────────────────────────────

export interface UserPhoto {
  id: string;
  url: string;
  position: number;
}

export interface AddPhotoRequest {
  url: string;
}

export interface UploadPhotoBase64Request {
  data: string;
  contentType: string;
  fileName?: string;
}

export interface ReorderPhotosRequest {
  photoIds: string[];
}

export interface DeleteAccountRequest {
  confirm: 'DELETE';
  password?: string;
}

// ─── Verification ────────────────────────────────────────────────────────────

export interface StartPhoneVerificationRequest {
  phone: string;
}

export interface StartPhoneVerificationResponse {
  sent: boolean;
  channel: 'sms' | 'dev';
}

export interface CheckPhoneVerificationRequest {
  phone: string;
  code: string;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export type PaidTier = Exclude<SubscriptionTier, 'free'>;

export interface SubscriptionPlan {
  tier: SubscriptionTier;
  name: string;
  priceLabel: string;
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    tier: 'free',
    name: 'Free',
    priceLabel: '$0',
    features: ['Appear on the map', 'Waves & chat', 'Daily challenges'],
  },
  {
    tier: 'basic',
    name: 'Basic',
    priceLabel: '$4.99/mo',
    features: ['Everything in Free', 'See who viewed you', 'Wider map reach'],
  },
  {
    tier: 'premium',
    name: 'Premium',
    priceLabel: '$9.99/mo',
    features: ['Everything in Basic', 'Priority in discovery', 'Premium badge'],
  },
];

export interface CreateCheckoutRequest {
  tier: PaidTier;
}

export interface CheckoutSessionResponse {
  url: string;
}

export interface PortalSessionResponse {
  url: string;
}

// ─── Social linking ──────────────────────────────────────────────────────────

export interface SocialAuthorizeResponse {
  url: string;
}

// ─── Chat (REST) ───────────────────────────────────────────────────────────

export type ChatMessageType = 'text' | 'location' | 'location_session';

export type LocationShareDuration = '15m' | '60m' | 'until_off';

export type LocationShareStatus = 'active' | 'ended';

export type LocationShareEndReason =
  | 'expired'
  | 'stopped'
  | 'timeout'
  | 'blocked'
  | 'conversation_closed';

export interface ChatLocation {
  lat: number;
  lng: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  /** Defaults to 'text' for messages created before live-location shipped. */
  type: ChatMessageType;
  location?: ChatLocation | null;
  locationSessionId?: string | null;
  createdAt: string;
}

export interface LocationShareSession {
  id: string;
  conversationId: string;
  sharerId: string;
  status: LocationShareStatus;
  duration: LocationShareDuration;
  startedAt: string;
  endsAt: string | null;
  lastLocation: ChatLocation;
  lastUpdatedAt: string;
  endedAt?: string | null;
  endReason?: LocationShareEndReason | null;
}

export interface ConversationParticipant {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export type ConversationStatus = 'pending' | 'accepted';

export interface ConversationSummary {
  id: string;
  participantIds: string[];
  participants: ConversationParticipant[];
  lastMessageAt: string | null;
  lastMessage: { senderId: string; body: string } | null;
  status: ConversationStatus;
  initiatedBy: string | null;
}

export interface MessagePage {
  messages: ChatMessage[];
  nextCursor: string | null;
}

export interface CreateConversationRequest {
  targetUserId: string;
}

export interface CreateConversationResponse {
  conversationId: string;
  status: ConversationStatus;
  permission: Exclude<MessagePermission, 'none'>;
}

// ─── Notifications ─────────────────────────────────────────────────────────

export interface RegisterDeviceTokenRequest {
  token: string;
  platform: 'ios' | 'android';
}

// ─── Geofences ─────────────────────────────────────────────────────────────

export interface CreateGeofenceRequest {
  label?: string;
  radiusRings?: number;
}

export interface GeofenceResponse {
  id: string;
  label: string;
  centerH3R7: string;
  radiusRings: number;
  inside: boolean;
  active: boolean;
  createdAt: string;
}

// ─── Alerts ────────────────────────────────────────────────────────────────

export interface CreateAlertRequest {
  category: AreaCategory;
  body: string;
  tag?: string;
}

export interface AlertResponse {
  id: string;
  category: AreaCategory;
  body: string;
  tag: string | null;
  createdAt: string;
}

// ─── Trending ──────────────────────────────────────────────────────────────

export interface TrendingResponse {
  topics: string[];
  generatedAt: string;
}

// ─── Received interactions (waves + story reactions toward me) ─────────────

export type ReceivedInteractionType = 'wave' | 'story_reaction';

export interface ReceivedInteraction {
  id: string;
  type: ReceivedInteractionType;
  fromUser: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    verification: VerificationLevel;
  };
  storyId?: string;
  reactionKind?: 'heart' | 'wave';
  createdAt: string;
  distanceMeters?: number;
  isMutual: boolean;
}

export interface ReceivedInteractionsResponse {
  items: ReceivedInteraction[];
}

// ─── Error envelope ────────────────────────────────────────────────────────

export interface ApiError {
  statusCode: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Re-export
export type { LatLng, Viewport };
