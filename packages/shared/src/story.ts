import type { LatLng, VerificationLevel } from './api';

/** Hard limits for story creation / media. */
export const STORY_LIMITS = {
  /** Max caption length (chars). */
  captionMax: 200,
  /** Max video duration (seconds). */
  videoMaxSeconds: 15,
  /** Stories live this long after create. */
  ttlHours: 24,
  /** Max concurrent active stories per user. */
  maxActivePerUser: 10,
  /** Nearby query hard cap. */
  nearbyLimit: 50,
  /**
   * Softer post gate: min account age (ms) when not phone-verified.
   * Phone+ accounts skip the age check.
   */
  minAccountAgeMs: 24 * 60 * 60 * 1000,
  /** Rolling 24h create cap for email-only (softer-gated) accounts. */
  softerGateMaxPer24h: 3,
  /** Rolling 24h create cap for phone+ accounts. */
  phoneVerifiedMaxPer24h: 20,
} as const;

/** Ladder order for verification_level comparisons. */
const LEVEL_RANK: Record<VerificationLevel, number> = {
  none: 0,
  email: 1,
  phone: 2,
  selfie: 3,
  id: 4,
};

export type StoryGateReason =
  | 'ok'
  | 'email_unverified'
  | 'account_too_new'
  | 'phone_required'
  | 'suspended';

/** Rolling strike weight that escalates the soft gate (shared client/server). */
export const STRIKE_THRESHOLDS = {
  /** At/above → require phone to post stories. */
  phoneRequired: 3,
  /** At/above → set story_suspended_until (server applies duration). */
  suspend: 5,
  /** Suspension length after hitting suspend threshold. */
  suspendDays: 7,
} as const;

/**
 * Client/server shared eligibility for posting stories.
 * Soft gate: email verified + account age ≥ 24h (no phone required).
 * Phone+ skips the age floor so verified users can post immediately after email+phone.
 */
export function canPostStory(input: {
  verification: VerificationLevel;
  createdAt: string | Date;
  now?: number;
  /** Sum of strike weights in the relevant window (server-supplied). */
  strikePoints?: number;
  /** ISO timestamp; when in the future, posting is blocked. */
  storySuspendedUntil?: string | Date | null;
}): { allowed: true } | { allowed: false; reason: Exclude<StoryGateReason, 'ok'> } {
  const now = input.now ?? Date.now();
  if (input.storySuspendedUntil) {
    const until =
      typeof input.storySuspendedUntil === 'string'
        ? new Date(input.storySuspendedUntil).getTime()
        : input.storySuspendedUntil.getTime();
    if (Number.isFinite(until) && until > now) {
      return { allowed: false, reason: 'suspended' };
    }
  }

  const rank = LEVEL_RANK[input.verification] ?? 0;
  if (rank < LEVEL_RANK.email) {
    return { allowed: false, reason: 'email_unverified' };
  }

  const strikes = input.strikePoints ?? 0;
  // Escalation: enough strikes → phone required (email-only soft-gate users).
  if (strikes >= STRIKE_THRESHOLDS.phoneRequired && rank < LEVEL_RANK.phone) {
    return { allowed: false, reason: 'phone_required' };
  }

  // Phone+ may post regardless of age (already passed stronger trust).
  if (rank >= LEVEL_RANK.phone) {
    return { allowed: true };
  }
  const created =
    typeof input.createdAt === 'string'
      ? new Date(input.createdAt).getTime()
      : input.createdAt.getTime();
  if (!Number.isFinite(created) || now - created < STORY_LIMITS.minAccountAgeMs) {
    return { allowed: false, reason: 'account_too_new' };
  }
  return { allowed: true };
}

export function storyGateMessage(
  reason: Exclude<StoryGateReason, 'ok'>,
): string {
  switch (reason) {
    case 'email_unverified':
      return 'Verify your email to post stories.';
    case 'account_too_new':
      return 'Your account needs to be at least 24 hours old to post stories.';
    case 'phone_required':
      return 'Phone verification required to post stories.';
    case 'suspended':
      return 'Story posting is temporarily suspended. Try again later.';
  }
}

export type StoryMediaType = 'image' | 'video';
/** Story reactions are first-class signals equal to waves for mutual unlock. */
export type StoryReactionKind = 'heart' | 'wave';

/** Lightweight card for Pulse strip / map indicators / profile rings. */
export interface StoryCard {
  id: string;
  authorId: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  authorVerification: VerificationLevel;
  mediaUrl: string;
  mediaType: StoryMediaType;
  caption: string | null;
  /** Approximate public location (r10 fuzz). */
  approxLocation: LatLng;
  expiresAt: string;
  createdAt: string;
  viewCount: number;
  reactionCount: number;
  /** Present when the requesting user has viewed this story. */
  viewedByMe: boolean;
  /** Present when the requesting user reacted. */
  myReaction: StoryReactionKind | null;
}

/** Realtime fanout when a new story is posted into a cell. */
export interface StoryNewEvent {
  story: StoryCard;
  /** H3 r7 cell the story was indexed into (for room targeting). */
  cellId: string;
}

export interface CreateStoryResponse {
  story: StoryCard;
}

export interface StoryPresignResponse {
  uploadUrl: string;
  publicUrl: string;
}

export interface NearbyStoriesResponse {
  stories: StoryCard[];
}

export interface RecordViewResponse {
  viewed: true;
  viewCount: number;
}

export interface ReactStoryResponse {
  reaction: StoryReactionKind;
  reactionCount: number;
}
