import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import type { PlaceMapEntityPoint } from '@g88/shared';

const mockDispatch = jest.fn();
const mockGetCurrentLocation = jest.fn();
let mockCheckInSubmitting = false;
let mockCheckInError: string | null = null;

jest.mock('@/hooks/redux', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: () => ({
    checkInSubmitting: mockCheckInSubmitting,
    checkInError: mockCheckInError,
  }),
}));

jest.mock('@/features/location/useUserLocation', () => ({
  useUserLocation: () => ({
    getCurrentLocation: mockGetCurrentLocation,
  }),
}));

jest.mock('@/features/pulse/pulseSlice', () => ({
  clearCheckInError: jest.fn(() => ({ type: 'pulse/clearCheckInError' })),
  createPlacePulseCheckIn: jest.fn((payload: unknown) => ({
    type: 'pulse/createPlaceCheckIn',
    payload,
  })),
}));

jest.mock('@/features/places/sharePlace', () => ({
  sharePlace: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/motion/useNexaReducedMotion', () => ({
  useNexaReducedMotion: () => true,
}));

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

jest.mock('@/theme', () => {
  const actual = jest.requireActual<typeof import('@/theme')>('@/theme');
  return {
    ...actual,
    useAppTheme: () => ({
      colors: actual.darkColors,
      scheme: 'dark',
      mode: 'dark',
      shadow: () => ({}),
    }),
  };
});

import { createPlacePulseCheckIn } from '@/features/pulse/pulseSlice';
import { PlaceMapPreviewSheet } from './PlaceMapPreviewSheet';

const PLACE: PlaceMapEntityPoint = {
  kind: 'place',
  id: '11111111-1111-4111-8111-111111111111',
  lat: 43.207,
  lng: 27.927,
  meta: {
    canonicalLabel: 'Sea Garden',
    trending: true,
    recentActivityAt: '2026-11-01T18:00:00.000Z',
    locationPrecision: 'coarse',
    saved: false,
  },
};

function renderPreview(onCheckIn = jest.fn()) {
  return {
    onCheckIn,
    ui: render(
      <PlaceMapPreviewSheet
        point={PLACE}
        onCheckIn={onCheckIn}
        onToggleSaved={jest.fn()}
        onViewDetails={jest.fn()}
        saveLoading={false}
        saveError={null}
      />,
    ),
  };
}

describe('PlaceMapPreviewSheet map-local check-in', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckInSubmitting = false;
    mockCheckInError = null;
    mockGetCurrentLocation.mockReset();
    mockDispatch.mockImplementation((action: unknown) => {
      const typed = action as { type?: string };
      if (typed.type === 'pulse/createPlaceCheckIn') {
        return { unwrap: () => Promise.resolve({}) };
      }
      return action;
    });
  });

  it('opens the audience chooser without requesting location', () => {
    const { ui } = renderPreview();

    fireEvent.press(ui.getByLabelText('Check in at Sea Garden'));

    expect(mockGetCurrentLocation).not.toHaveBeenCalled();
    expect(ui.getByText(/Choose who can see this explicit check-in/)).toBeTruthy();
  });

  it('requests location only after audience selection and stays on the map after success', async () => {
    mockGetCurrentLocation.mockResolvedValue({ lat: 43.205, lng: 27.925 });
    const { ui, onCheckIn } = renderPreview();

    fireEvent.press(ui.getByLabelText('Check in at Sea Garden'));
    fireEvent.press(ui.getByLabelText('Friends. Visible only to your friends.'));

    await waitFor(() => {
      expect(createPlacePulseCheckIn).toHaveBeenCalledWith({
        placeId: PLACE.id,
        audience: 'friends',
        lat: 43.205,
        lng: 27.925,
      });
    });
    await waitFor(() => {
      expect(ui.getByLabelText('Checked in at Sea Garden')).toBeTruthy();
    });
    expect(onCheckIn).not.toHaveBeenCalled();
  });

  it('keeps the full-detail flow as an explicit error fallback', () => {
    mockCheckInError = 'Could not check in here';
    const onCheckIn = jest.fn();
    const { ui } = renderPreview(onCheckIn);

    fireEvent.press(ui.getByLabelText('Check in at Sea Garden'));
    fireEvent.press(ui.getByLabelText('Continue check-in in place details'));

    expect(onCheckIn).toHaveBeenCalledTimes(1);
  });
});
