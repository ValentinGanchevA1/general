import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { EventMeta } from '@g88/shared';
import { PortalEventPreview } from './PortalEventPreview';

jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    colors: jest.requireActual('@/theme/colors').darkColors,
  }),
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

const meta: EventMeta = {
  title: 'Sea Garden Meetup',
  coverUrl: null,
  startsAt: '2030-06-12T18:00:00.000Z',
  attendeeCount: 4,
  capacity: 10,
  hostDisplayName: 'Host',
};

describe('PortalEventPreview', () => {
  it('shows an event preview with explicit non-RSVP navigation', () => {
    const onEnter = jest.fn();
    const screen = render(
      <PortalEventPreview meta={meta} distanceLabel="1.2 km" onEnter={onEnter} />,
    );

    expect(screen.getByText('Sea Garden Meetup')).toBeTruthy();
    expect(screen.getByText('4 going · 10 capacity')).toBeTruthy();
    expect(screen.getByText('Approximately 1.2 km away')).toBeTruthy();
    expect(screen.getByText('Hosted by Host')).toBeTruthy();
    expect(screen.getByText('Entering a Portal does not RSVP or share your activity.')).toBeTruthy();
    expect(onEnter).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Explore Portal for Sea Garden Meetup' }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it('does not invent distance, host, or confirmed live state when metadata is missing', () => {
    const screen = render(
      <PortalEventPreview
        meta={{ ...meta, startsAt: '2020-01-01T18:00:00.000Z', capacity: null, hostDisplayName: '' }}
        distanceLabel={null}
        onEnter={jest.fn()}
      />,
    );

    expect(screen.queryByText(/approximately/i)).toBeNull();
    expect(screen.queryByText(/hosted by/i)).toBeNull();
    expect(screen.getByText('Started · check event details')).toBeTruthy();
    expect(screen.queryByText(/live now/i)).toBeNull();
  });
});
