import React from 'react';
import { render } from '@testing-library/react-native';

import { PortalEntryBanner } from './PortalEntryBanner';

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    colors: jest.requireActual('@/theme/colors').darkColors,
  }),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

const state = {
  status: 'upcoming' as const,
  statusLabel: 'Upcoming',
  description: 'Explore the event, then choose whether to RSVP.',
  canChangeRsvp: true,
  canRequestGoing: true,
};

describe('PortalEntryBanner', () => {
  it('communicates entry without performing RSVP or public sharing', () => {
    const screen = render(<PortalEntryBanner state={state} currentRsvp={null} />);
    expect(screen.getByTestId('portal-entry-banner')).toBeTruthy();
    expect(screen.getByText('NEXA / PORTAL EXPERIENCE')).toBeTruthy();
    expect(screen.getByTestId('portal-detail-status').props.accessibilityRole).toBe('header');
    expect(screen.getByText('Viewing this Portal does not RSVP or share your activity.')).toBeTruthy();
    expect(screen.queryByText('Join')).toBeNull();
  });

  it('keeps previous participation visible without changing it', () => {
    const screen = render(<PortalEntryBanner state={state} currentRsvp="going" />);
    expect(screen.getByText('Your current RSVP: going. Entering the Portal does not change it.')).toBeTruthy();
  });

  it('uses the read-only ending message', () => {
    const screen = render(
      <PortalEntryBanner
        state={{
          status: 'ended',
          statusLabel: 'Event ended',
          description: 'This event has ended. RSVP changes are unavailable here.',
          canChangeRsvp: false,
          canRequestGoing: false,
        }}
        currentRsvp={null}
      />,
    );
    expect(screen.getByText('Event ended')).toBeTruthy();
  });
});
