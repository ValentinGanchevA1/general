// apps/mobile/src/features/events/useEvents.ts
//
// Data layer for the P3.5 events surface. Mirrors the useGamification /
// useChallenges pattern (useState + refresh) and wraps the /events REST API
// (see apps/backend/src/modules/events). Mutations are plain async helpers the
// screens call directly, then refresh the relevant hook.

import { useCallback, useEffect, useState } from 'react';

import type {
  CreateEventRequest,
  CreatePollRequest,
  CreateQuestionRequest,
  EventDetail,
  EventQuestion,
  EventSummary,
  LatLng,
  NearbyEventsRequest,
  PollResult,
  RsvpResponse,
  RsvpStatus,
} from '@g88/shared';
import { getJson, postJson, putJson } from '@/api/client';

// ─── Nearby ("events near you") ──────────────────────────────────────────────

interface UseNearbyEventsResult {
  events: EventSummary[];
  loading: boolean;
  refresh: () => void;
}

export function useNearbyEvents(location: LatLng | null): UseNearbyEventsResult {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    if (!location) return;
    void (async () => {
      setLoading(true);
      try {
        setEvents(
          await postJson<NearbyEventsRequest, EventSummary[]>('/events/nearby', { location }),
        );
      } catch {
        // keep stale data on error
      } finally {
        setLoading(false);
      }
    })();
  }, [location?.lat, location?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { refresh(); }, [refresh]);

  return { events, loading, refresh };
}

// ─── Single event (detail + polls + Q&A) ─────────────────────────────────────

interface UseEventResult {
  event: EventDetail | null;
  polls: PollResult[];
  questions: EventQuestion[];
  loading: boolean;
  refresh: () => void;
  refreshPolls: () => void;
  refreshQuestions: () => void;
}

export function useEvent(eventId: string): UseEventResult {
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [polls, setPolls] = useState<PollResult[]>([]);
  const [questions, setQuestions] = useState<EventQuestion[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshPolls = useCallback(() => {
    void (async () => {
      try {
        setPolls(await getJson<PollResult[]>(`/events/${eventId}/polls`));
      } catch {
        /* keep stale */
      }
    })();
  }, [eventId]);

  const refreshQuestions = useCallback(() => {
    void (async () => {
      try {
        setQuestions(await getJson<EventQuestion[]>(`/events/${eventId}/questions`));
      } catch {
        /* keep stale */
      }
    })();
  }, [eventId]);

  const refresh = useCallback(() => {
    void (async () => {
      setLoading(true);
      try {
        setEvent(await getJson<EventDetail>(`/events/${eventId}`));
      } catch {
        /* keep stale */
      } finally {
        setLoading(false);
      }
    })();
    refreshPolls();
    refreshQuestions();
  }, [eventId, refreshPolls, refreshQuestions]);

  useEffect(() => { refresh(); }, [refresh]);

  return { event, polls, questions, loading, refresh, refreshPolls, refreshQuestions };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function createEvent(req: CreateEventRequest): Promise<EventSummary> {
  return postJson<CreateEventRequest, EventSummary>('/events', req);
}

export function rsvpToEvent(eventId: string, status: RsvpStatus): Promise<RsvpResponse> {
  return putJson<{ status: RsvpStatus }, RsvpResponse>(`/events/${eventId}/rsvp`, { status });
}

export function createPoll(eventId: string, req: CreatePollRequest): Promise<PollResult> {
  return postJson<CreatePollRequest, PollResult>(`/events/${eventId}/polls`, req);
}

export function votePoll(pollId: string, optionId: string): Promise<PollResult> {
  return putJson<{ optionId: string }, PollResult>(`/events/polls/${pollId}/vote`, { optionId });
}

export function askQuestion(eventId: string, req: CreateQuestionRequest): Promise<EventQuestion> {
  return postJson<CreateQuestionRequest, EventQuestion>(`/events/${eventId}/questions`, req);
}

export function upvoteQuestion(questionId: string): Promise<{ id: string; upvotes: number }> {
  return putJson<Record<string, never>, { id: string; upvotes: number }>(
    `/events/questions/${questionId}/upvote`,
    {},
  );
}
