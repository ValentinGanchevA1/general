import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import type { WorldModeId } from '@/features/worldModes/worldModes';
import { MapWorldSelector } from './MapWorldSelector';

const mockState = {
  auth: { user: { id: 'user-1' } },
  worldModes: {
    selectedId: 'pathfinder' as WorldModeId,
    ownerId: 'user-1',
    hydrated: true,
    saving: false,
    error: null as string | null,
  },
};
const mockDispatch = jest.fn();

jest.mock('@/hooks/redux', () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: typeof mockState) => unknown) => selector(mockState),
}));

jest.mock('@/features/worldModes/worldModesSlice', () => ({
  activateWorldMode: jest.fn((value: { userId: string; id: WorldModeId }) => ({
    type: 'worldModes/activate',
    payload: value,
  })),
  clearWorldModeError: jest.fn(() => ({ type: 'worldModes/clearError' })),
}));

jest.mock('@/theme', () => {
  const actual = jest.requireActual('@/theme');
  return {
    ...actual,
    useAppTheme: () => ({
      colors: jest.requireActual('@/theme/colors').darkColors,
    }),
  };
});
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');

describe('MapWorldSelector context preview (W2-8)', () => {
  beforeEach(() => {
    mockState.worldModes.selectedId = 'pathfinder';
    mockDispatch.mockClear();
  });

  it('shows Pathfinder focus and action suggestions without making them controls', () => {
    const screen = render(<MapWorldSelector />);
    fireEvent.press(screen.getByTestId('map-world-selector-open'));

    expect(screen.getByTestId('map-world-context-preview')).toBeTruthy();
    expect(screen.getByText('Places & experiences')).toBeTruthy();
    expect(screen.getByText('Suggested lens: Experiences')).toBeTruthy();
    expect(screen.getByText('places · routes · saved destinations')).toBeTruthy();
    expect(screen.getByText('Suggested actions: Save destination · Explore experience')).toBeTruthy();
    expect(screen.getByText(/suggestions only/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save destination' })).toBeNull();
  });

  it('updates the preview for Bazaar while keeping the suggested lens informational', () => {
    mockState.worldModes.selectedId = 'bazaar';
    const screen = render(<MapWorldSelector />);
    fireEvent.press(screen.getByTestId('map-world-selector-open'));

    expect(screen.getByText('Local marketplace')).toBeTruthy();
    expect(screen.getByText('Suggested lens: Opportunities')).toBeTruthy();
    expect(screen.getByText('Suggested actions: View listing')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'View listing' })).toBeNull();
  });

  it('uses the shared-map fallback for Worlds without discovery presets', () => {
    mockState.worldModes.selectedId = 'nexus';
    const screen = render(<MapWorldSelector />);
    fireEvent.press(screen.getByTestId('map-world-selector-open'));

    expect(screen.getByText('Shared NEXUS map')).toBeTruthy();
    expect(screen.getByText('Use the shared map controls for discovery')).toBeTruthy();
  });
});
