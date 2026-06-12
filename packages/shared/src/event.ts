// packages/shared/src/event.ts
//
// P3.5 Events — domain DTOs shared between backend and mobile.
// (NB: events.ts in this package is the *socket* contract file; this singular
//  file is the events *feature* — RSVP, polls, Q&A.)

import type { LatLng } from './geo';

// ─── RSVP ───────────────────────────────────────────────────────────────────

export const RSVP_STATUSES = ['going', 'maybe', 'declined'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const EVENT_VISIBILITIES = ['public', 'private'] as const;
export type EventVisibility = (typeof EVENT_VISIBILITIES)[number];

// ─── Field limits (mirrored by class-validator on the backend DTOs) ──────────

export const EVENT_LIMITS = {
  titleMax: 120,
  descriptionMax: 2000,
  capacityMax: 100_000,
  pollQuestionMax: 200,
  pollOptionMax: 80,
  pollOptionsMin: 2,
  pollOptionsMax: 6,
  questionBodyMax: 500,
} as const;

// ─── Create / read ───────────────────────────────────────────────────────────

export interface CreateEventRequest {
  title: string;
  description?: string;
  coverUrl?: string;
  /** ISO 8601. Must be in the future. */
  startsAt: string;
  /** ISO 8601. Must be after startsAt when provided. */
  endsAt?: string;
  /** Host-published venue pin (stored precisely — it is not personal location). */
  location: LatLng;
  capacity?: number;
  visibility?: EventVisibility;
}

/** Compact event for list/rail surfaces ("events near you"). */
export interface EventSummary {
  id: string;
  hostId: string;
  title: string;
  coverUrl: string | null;
  startsAt: string;
  endsAt: string | null;
  location: LatLng;
  capacity: number | null;
  attendeeCount: number;
  visibility: EventVisibility;
  /** The calling user's RSVP, if any. */
  myRsvp: RsvpStatus | null;
}

export interface EventAttendee {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  status: RsvpStatus;
}

/** Full event detail (event screen). */
export interface EventDetail extends EventSummary {
  description: string | null;
  hostDisplayName: string;
  hostAvatarUrl: string | null;
  /** First page of attendees (status = 'going'), capped server-side. */
  attendees: EventAttendee[];
}

export interface NearbyEventsRequest {
  /** Map center. */
  location: LatLng;
  /** Search radius in meters (default 5000, capped server-side). */
  radiusM?: number;
  limit?: number;
}

// ─── RSVP ─────────────────────────────────────────────────────────────────

export interface RsvpRequest {
  status: RsvpStatus;
}

export interface RsvpResponse {
  eventId: string;
  status: RsvpStatus;
  attendeeCount: number;
}

// ─── Polls ────────────────────────────────────────────────────────────────

export interface CreatePollRequest {
  question: string;
  /** 2–6 option labels. */
  options: string[];
}

export interface PollOptionResult {
  id: string;
  label: string;
  votes: number;
}

export interface PollResult {
  id: string;
  eventId: string;
  question: string;
  options: PollOptionResult[];
  totalVotes: number;
  closedAt: string | null;
  /** The option this user voted for, if any. */
  myVote: string | null;
}

export interface VotePollRequest {
  optionId: string;
}

// ─── Q&A ────────────────────────────────────────────────────────────────────

export interface CreateQuestionRequest {
  body: string;
}

export interface EventQuestion {
  id: string;
  eventId: string;
  userId: string;
  displayName: string;
  body: string;
  upvotes: number;
  answered: boolean;
  /** Whether the calling user has upvoted. */
  upvotedByMe: boolean;
  createdAt: string;
}
