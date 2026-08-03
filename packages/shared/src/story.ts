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
} as const;

export type StoryMediaType = 'image' | 'video';
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
