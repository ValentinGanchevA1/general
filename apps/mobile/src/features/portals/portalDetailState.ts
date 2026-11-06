import type { EventDetail, RsvpStatus } from '@g88/shared';

export type PortalDetailStatus =
  | 'upcoming'
  | 'started'
  | 'at-capacity'
  | 'ended'
  | 'schedule-unavailable';

export type PortalDetailProjection = {
  status: PortalDetailStatus;
  statusLabel: string;
  description: string;
  canChangeRsvp: boolean;
  canRequestGoing: boolean;
};

type PortalEventFields = Pick<
  EventDetail,
  'startsAt' | 'endsAt' | 'capacity' | 'attendeeCount' | 'myRsvp'
>;

/**
 * Only EventDetail (authorized REST data) can establish the event's end time.
 * Started != LIVE, and an RSVP != physical presence.
 * The backend still owns the final RSVP authorization and capacity check.
 */
export function resolvePortalDetailState(
  event: PortalEventFields,
  nowMs: number,
): PortalDetailProjection {
  const startMs = Date.parse(event.startsAt);
  const endMs = event.endsAt == null ? null : Date.parse(event.endsAt);
  if (
    !Number.isFinite(startMs) ||
    (endMs !== null && (!Number.isFinite(endMs) || endMs < startMs))
  ) {
    return {
      status: 'schedule-unavailable',
      statusLabel: 'Schedule unavailable',
      description: 'Event dates could not be verified. Refresh before responding.',
      canChangeRsvp: false,
      canRequestGoing: false,
    };
  }

  if (endMs !== null && nowMs >= endMs) {
    return {
      status: 'ended',
      statusLabel: 'Event ended',
      description: 'This event has ended. RSVP changes are unavailable here.',
      canChangeRsvp: false,
      canRequestGoing: false,
    };
  }

  const full =
    event.capacity != null &&
    Number.isFinite(event.capacity) &&
    event.capacity > 0 &&
    event.attendeeCount >= event.capacity;

  if (full && event.myRsvp !== 'going') {
    return {
      status: 'at-capacity',
      statusLabel: 'At capacity',
      description: 'No new Going RSVPs are available. You can still review the event.',
      canChangeRsvp: true,
      canRequestGoing: false,
    };
  }

  if (nowMs >= startMs) {
    return {
      status: 'started',
      statusLabel: 'Started',
      description: 'The scheduled start has passed. This does not confirm live attendance.',
      canChangeRsvp: true,
      canRequestGoing: true,
    };
  }

  return {
    status: 'upcoming',
    statusLabel: 'Upcoming',
    description: 'Explore the event, then choose whether to RSVP.',
    canChangeRsvp: true,
    canRequestGoing: true,
  };
}

export function canSubmitPortalRsvp(
  event: PortalEventFields,
  status: RsvpStatus,
  nowMs: number,
): boolean {
  const state = resolvePortalDetailState(event, nowMs);
  return state.canChangeRsvp && (status !== 'going' || state.canRequestGoing);
}

export type PortalLoadPresentation = {
  title: string;
  body: string;
  canRetry: boolean;
};

/**
 * Do not reveal whether a private/blocked event exists: 403 and 404 are
 * intentionally indistinguishable. No raw API errors reach user-visible copy.
 */
export function resolvePortalLoadPresentation(error: unknown): PortalLoadPresentation {
  const status =
    error != null && typeof error === 'object' && 'statusCode' in error &&
    typeof error.statusCode === 'number'
      ? error.statusCode
      : null;

  if (status === 403 || status === 404) {
    return {
      title: 'Portal unavailable',
      body: 'This event is unavailable or you do not have access.',
      canRetry: false,
    };
  }

  if (status === 401) {
    return {
      title: 'Sign in required',
      body: 'Sign in to access this event.',
      canRetry: false,
    };
  }

  return {
    title: 'Could not load Portal',
    body: 'Check your connection and try again. No RSVP has been made.',
    canRetry: true,
  };
}

export interface PortalRsvpFailure {
  message: string;
  accessLost: boolean;
  requiresRefresh: boolean;
  statusCode: number | null;
}

/**
 * API conflict codes, not HTTP 409 alone, distinguish lifecycle from capacity.
 * Do not pass untrusted server exception text into user-visible screens.
 */
export function resolvePortalRsvpFailure(error: unknown): PortalRsvpFailure {
  const statusCode =
    error != null && typeof error === 'object' && 'statusCode' in error &&
    typeof error.statusCode === 'number'
      ? error.statusCode
      : null;
  const code =
    error != null && typeof error === 'object' && 'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : null;

  if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
    return {
      message: 'Portal unavailable. Your event access may have changed.',
      accessLost: true,
      requiresRefresh: false,
      statusCode,
    };
  }
  if (statusCode === 409) {
    const message = code === 'event.ended'
      ? 'This event has ended. RSVP changes are unavailable.'
      : code === 'event.full'
        ? 'This event is at capacity. Refresh to check availability.'
        : 'Event availability has changed. Refresh before responding.';
    return { message, accessLost: false, requiresRefresh: true, statusCode };
  }
  return {
    message: 'Could not confirm your RSVP. Refresh to check the latest status.',
    accessLost: false,
    requiresRefresh: true,
    statusCode,
  };
}
