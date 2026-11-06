import type { EventDetail } from '@g88/shared';
import {
  canSubmitPortalRsvp,
  resolvePortalDetailState,
  resolvePortalLoadPresentation,
} from './portalDetailState';

const now = Date.parse('2026-11-06T11:00:00.000Z');
const event: Pick<EventDetail, 'startsAt' | 'endsAt' | 'capacity' | 'attendeeCount' | 'myRsvp'> = {
  startsAt: '2026-11-07T12:00:00.000Z',
  endsAt: '2026-11-07T13:00:00.000Z',
  capacity: 10,
  attendeeCount: 4,
  myRsvp: null,
};

describe('Portal detail state', () => {
  it('marks a future event upcoming and RSVP remains an explicit separate action', () => {
    expect(resolvePortalDetailState(event, now)).toEqual({
      status: 'upcoming',
      statusLabel: 'Upcoming',
      description: 'Explore the event, then choose whether to RSVP.',
      canChangeRsvp: true,
      canRequestGoing: true,
    });
    expect(canSubmitPortalRsvp(event, 'going', now)).toBe(true);
  });

  it('never treats a started event without an end as confirmed live', () => {
    const state = resolvePortalDetailState(
      { ...event, startsAt: '2026-11-05T12:00:00.000Z', endsAt: null }, now,
    );
    expect(state.status).toBe('started');
    expect(state.statusLabel.toLowerCase()).not.toContain('live');
    expect(state.description.toLowerCase()).toContain('does not confirm');
  });

  it('marks ended events read-only even when attendee capacity is available', () => {
    const ended = {
      ...event,
      startsAt: '2026-11-05T12:00:00.000Z',
      endsAt: '2026-11-05T13:00:00.000Z',
    };
    expect(resolvePortalDetailState(ended, now).status).toBe('ended');
    expect(canSubmitPortalRsvp(ended, 'going', now)).toBe(false);
    expect(canSubmitPortalRsvp(ended, 'maybe', now)).toBe(false);
    expect(canSubmitPortalRsvp(ended, 'declined', now)).toBe(false);
  });

  it('rejects a new Going RSVP at capacity while allowing a Maybe choice', () => {
    const full = { ...event, attendeeCount: 10 };
    const state = resolvePortalDetailState(full, now);
    expect(state.status).toBe('at-capacity');
    expect(state.canRequestGoing).toBe(false);
    expect(canSubmitPortalRsvp(full, 'going', now)).toBe(false);
    expect(canSubmitPortalRsvp(full, 'maybe', now)).toBe(true);
  });

  it('does not revoke an existing confirmed Going RSVP just because an event is full', () => {
    const mine = { ...event, attendeeCount: 10, myRsvp: 'going' as const };
    expect(resolvePortalDetailState(mine, now).canRequestGoing).toBe(true);
    expect(canSubmitPortalRsvp(mine, 'going', now)).toBe(true);
  });

  it('invalid or inverted schedules cannot make a new RSVP appear safe', () => {
    const invalid = { ...event, startsAt: 'not-a-date' };
    const inverted = { ...event, endsAt: '2020-01-01T00:00:00.000Z' };
    for (const item of [invalid, inverted]) {
      const state = resolvePortalDetailState(item, now);
      expect(state.status).toBe('schedule-unavailable');
      expect(state.canChangeRsvp).toBe(false);
      expect(canSubmitPortalRsvp(item, 'going', now)).toBe(false);
    }
  });

  it('handles the exact end boundary as ended', () => {
    const endMs = Date.parse(event.endsAt!);
    const started = { ...event, startsAt: '2026-11-06T09:00:00.000Z' };
    expect(resolvePortalDetailState(started, endMs).status).toBe('ended');
  });
});

describe('Portal safe load copy', () => {
  it('does not reveal whether an event is private, blocked, deleted, or absent', () => {
    const forbidden = resolvePortalLoadPresentation({ statusCode: 403, message: 'blocked by host' });
    const missing = resolvePortalLoadPresentation({ statusCode: 404, message: 'private event ID' });
    expect(forbidden).toEqual(missing);
    expect(forbidden.title).toBe('Portal unavailable');
    expect(forbidden.canRetry).toBe(false);
    expect(forbidden.body.toLowerCase()).not.toContain('blocked');
  });

  it('provides a safe retry for offline, timeout, server and unknown transport errors', () => {
    for (const error of [
      { statusCode: 0, message: 'network error' },
      { statusCode: 503, message: 'internal postgres details' },
      new Error('sensitive transport detail'),
    ]) {
      const view = resolvePortalLoadPresentation(error);
      expect(view.canRetry).toBe(true);
      expect(view.body).toContain('No RSVP has been made');
      expect(view.body).not.toContain('postgres');
    }
  });

  it('does not claim sign-in fixed an authorization denial', () => {
    expect(resolvePortalLoadPresentation({ statusCode: 401 })).toEqual({
      title: 'Sign in required',
      body: 'Sign in to access this event.',
      canRetry: false,
    });
  });
});
