import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import type { EventDetail } from '@g88/shared';

import { rsvpToEvent, useEvent } from '@/features/events/useEvents';
import { EventDetailScreen } from './EventDetailScreen';

let mockRoute: { params: { eventId: string; entry?: 'portal' } } = {
  params: { eventId: 'portal-event', entry: 'portal' },
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
  useRoute: () => mockRoute,
}));
jest.mock('@/components/ScreenHeader', () => ({ ScreenHeader: 'ScreenHeader' }));
jest.mock('@/components/EmptyState', () => ({ EmptyState: 'EmptyState' }));
jest.mock('@/features/events/EventReviewsSection', () => ({
  EventReviewsSection: 'EventReviewsSection',
}));
jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    colors: jest.requireActual('@/theme/colors').darkColors,
  }),
}));
jest.mock('@/hooks/redux', () => ({
  useAppSelector: () => 'viewer-id',
}));
jest.mock('@/navigation/openRootScreen', () => ({
  openRootScreen: jest.fn(),
  openViaRef: jest.fn(),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('@/features/events/useEvents', () => ({
  useEvent: jest.fn(),
  rsvpToEvent: jest.fn(),
  shareEventJoinToPulse: jest.fn(),
  askQuestion: jest.fn(),
  createPoll: jest.fn(),
  upvoteQuestion: jest.fn(),
  votePoll: jest.fn(),
}));

const event: EventDetail = {
  id: 'portal-event',
  hostId: 'host-id',
  hostDisplayName: 'Host',
  hostAvatarUrl: null,
  title: 'Sea Garden Meet-up',
  coverUrl: null,
  startsAt: '2030-01-01T10:00:00.000Z',
  endsAt: '2030-01-01T12:00:00.000Z',
  location: { lat: 43.2, lng: 27.9 },
  capacity: 10,
  attendeeCount: 4,
  visibility: 'public',
  myRsvp: null,
  attendees: [],
  description: 'A local event.',
};

function setup(detail: EventDetail | null = event, error: unknown | null = null, loading = false) {
  const refresh = jest.fn();
  jest.mocked(useEvent).mockReturnValue({
    event: detail,
    polls: [],
    questions: [],
    loading,
    error,
    refresh,
    refreshPolls: jest.fn(),
    refreshQuestions: jest.fn(),
  });
  return { screen: render(<EventDetailScreen />), refresh };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRoute = { params: { eventId: 'portal-event', entry: 'portal' } };
});

describe('Portal Entry EventDetail integration', () => {
  it('shows authenticated Portal details but never RSVPs just from entering', () => {
    const { screen } = setup();
    expect(screen.getByTestId('portal-entry-banner')).toBeTruthy();
    expect(screen.getByText('Sea Garden Meet-up')).toBeTruthy();
    expect(screen.getByText('Viewing this Portal does not RSVP or share your activity.')).toBeTruthy();
    expect(rsvpToEvent).not.toHaveBeenCalled();
  });

  it('uses an explicit Going press to call the existing RSVP API', async () => {
    jest.mocked(rsvpToEvent).mockResolvedValueOnce({
      eventId: 'portal-event',
      status: 'going',
      attendeeCount: 5,
    });
    const { screen, refresh } = setup();
    expect(rsvpToEvent).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('event-rsvp-going'));
    await waitFor(() => expect(rsvpToEvent).toHaveBeenCalledWith('portal-event', 'going'));
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
  });

  it('holds RSVP buttons while the authoritative Portal detail request is refreshing', () => {
    const { screen } = setup(event, null, true);
    expect(screen.getByText('Sea Garden Meet-up')).toBeTruthy();
    for (const status of ['going', 'maybe', 'declined']) {
      const button = screen.getByTestId(`event-rsvp-${status}`);
      expect(button.props.accessibilityState.disabled).toBe(true);
      fireEvent.press(button);
    }
    expect(rsvpToEvent).not.toHaveBeenCalled();
  });

  it('distinguishes backend ended conflicts and refreshes without claiming capacity is full', async () => {
    jest.mocked(rsvpToEvent).mockRejectedValueOnce({
      statusCode: 409,
      code: 'event.ended',
      message: 'internal event state',
    });
    const { screen, refresh } = setup();

    fireEvent.press(screen.getByTestId('event-rsvp-going'));
    await waitFor(() => expect(screen.getByTestId('portal-rsvp-error')).toBeTruthy());
    expect(screen.getByText('This event has ended. RSVP changes are unavailable.')).toBeTruthy();
    expect(screen.queryByText(/may be full/i)).toBeNull();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('hides cached event data immediately when an RSVP returns access revoked', async () => {
    jest.mocked(rsvpToEvent).mockRejectedValueOnce({
      statusCode: 404,
      code: 'event.not_found',
      message: 'hidden private venue',
    });
    const { screen } = setup();

    fireEvent.press(screen.getByTestId('event-rsvp-going'));
    await waitFor(() => expect(screen.queryByText('Sea Garden Meet-up')).toBeNull());
    const empty = screen.UNSAFE_getByType('EmptyState');
    expect(empty.props.title).toBe('Portal unavailable');
    expect(empty.props.body).not.toContain('hidden private venue');
  });

  it('refreshes the visible lifecycle automatically at event start and end boundaries', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2030-01-01T09:59:59.000Z'));
    try {
      const { screen } = setup();
      expect(screen.getByText('Upcoming')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(1_500);
      });
      expect(screen.getByText('Started')).toBeTruthy();

      act(() => {
        jest.advanceTimersByTime(2 * 60 * 60 * 1000);
      });
      expect(screen.getByText('Event ended')).toBeTruthy();
      expect(screen.getByTestId('event-rsvp-going').props.accessibilityState.disabled).toBe(true);
      screen.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('revalidates event access on app foreground without auto-RSVPing', () => {
    const { AppState } = jest.requireActual('react-native') as typeof import('react-native');
    const existing = AppState.addEventListener;
    let foregroundHandler: ((status: 'active' | 'background' | 'inactive') => void) | null = null;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      foregroundHandler = handler as (status: 'active' | 'background' | 'inactive') => void;
      return { remove: jest.fn() };
    });
    try {
      const { screen, refresh } = setup();
      expect(foregroundHandler).not.toBeNull();
      act(() => foregroundHandler?.('active'));
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(rsvpToEvent).not.toHaveBeenCalled();
      screen.unmount();
    } finally {
      spy.mockRestore();
      void existing;
    }
  });

  it('prevents changes to past events through a Portal entry', () => {
    const ended: EventDetail = {
      ...event,
      startsAt: '2020-01-01T10:00:00.000Z',
      endsAt: '2020-01-01T12:00:00.000Z',
    };
    const { screen } = setup(ended);
    expect(screen.getByText('Event ended')).toBeTruthy();
    for (const status of ['going', 'maybe', 'declined']) {
      expect(screen.getByTestId(`event-rsvp-${status}`).props.accessibilityState.disabled).toBe(true);
    }
    expect(rsvpToEvent).not.toHaveBeenCalled();
  });

  it('prevents new Going RSVPs when the event has reached capacity', () => {
    const { screen } = setup({ ...event, attendeeCount: 10 });
    expect(screen.getByText('At capacity')).toBeTruthy();
    expect(screen.getByTestId('event-rsvp-going').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('event-rsvp-maybe').props.accessibilityState.disabled).toBe(false);
  });

  it('hides even previously loaded details after a 403/404 access revocation', () => {
    for (const code of [403, 404]) {
      const { screen } = setup(event, { statusCode: code, message: 'private event data' });
      expect(screen.queryByText('Sea Garden Meet-up')).toBeNull();
      expect(screen.queryByTestId('portal-entry-banner')).toBeNull();
      const empty = screen.UNSAFE_getByType('EmptyState');
      expect(empty.props.title).toBe('Portal unavailable');
      expect(empty.props.body).not.toContain('private event data');
      screen.unmount();
    }
  });

  it('shows retry state without stale metadata when offline', () => {
    const { screen } = setup(event, { statusCode: 0, message: 'Network Error' });
    expect(screen.queryByText('Sea Garden Meet-up')).toBeNull();
    const empty = screen.UNSAFE_getByType('EmptyState');
    expect(empty.props.title).toBe('Could not load Portal');
    expect(typeof empty.props.onAction).toBe('function');
    expect(rsvpToEvent).not.toHaveBeenCalled();
  });

  it('preserves legacy EventDetail rendering when not entered as a Portal', () => {
    mockRoute = { params: { eventId: 'portal-event' } };
    const { screen } = setup();
    expect(screen.queryByTestId('portal-entry-banner')).toBeNull();
    expect(screen.getByText('Sea Garden Meet-up')).toBeTruthy();
  });
});
