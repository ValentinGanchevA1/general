import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { nexaSpatialLensStore } from '@/features/map/nexaSpatialLens.store';
import worldModesReducer, { hydrateWorldMode } from './worldModesSlice';
import worldFusionReducer, { hydrateWorldFusion } from './worldFusionSlice';
import { WorldFusionScreen } from './WorldFusionScreen';

jest.mock('@/components/ScreenHeader', () => ({
  ScreenHeader: 'ScreenHeader',
}));
jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('@/theme', () => ({
  useAppTheme: () => ({
    colors: jest.requireActual('@/theme/colors').darkColors,
  }),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function makeStore(userId: string) {
  return configureStore({
    reducer: {
      auth: () => ({ user: { id: userId } }),
      worldModes: worldModesReducer,
      worldFusion: worldFusionReducer,
    },
  });
}

async function setup() {
  const store = makeStore('user-a');
  await store.dispatch(hydrateWorldMode('user-a'));
  await store.dispatch(hydrateWorldFusion('user-a'));
  const screen = render(
    <Provider store={store}>
      <WorldFusionScreen />
    </Provider>,
  );
  return { store, screen };
}

describe('WorldFusionScreen interaction flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    nexaSpatialLensStore.set('map');
  });

  it('shows active appearance and previews a different World without saving', async () => {
    const { screen } = await setup();
    expect(screen.getByText('Combine two worlds.')).toBeTruthy();
    expect(screen.getByTestId('fusion-appearance-world')).toBeTruthy();
    expect(screen.getByText('No Fusion currently active')).toBeTruthy();
    expect(screen.queryByTestId('fusion-option-nexus')).toBeNull();

    fireEvent.press(screen.getByTestId('fusion-option-nocturne'));
    expect(screen.getByText('Nocturne discovery inspiration')).toBeTruthy();
    expect(screen.getByText(/Suggested existing lens: Experiences/)).toBeTruthy();
    expect(screen.getByTestId('fusion-option-nocturne').props.accessibilityState.selected)
      .toBe(true);
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(nexaSpatialLensStore.getSnapshot()).toBe('map');
  });

  it('applies Fusion only after explicit confirmation, without mutating map lens', async () => {
    const { screen, store } = await setup();
    nexaSpatialLensStore.set('opportunities');
    fireEvent.press(screen.getByTestId('fusion-option-sanctuary'));
    expect(storage.setItem).not.toHaveBeenCalled();

    fireEvent.press(screen.getByTestId('fusion-apply'));
    await waitFor(() => expect(store.getState().worldFusion.discoveryWorld).toBe('sanctuary'));

    expect(storage.setItem).toHaveBeenCalledWith(
      'g88:world-fusion:v1:user-a',
      JSON.stringify({ version: 1, discoveryWorld: 'sanctuary' }),
    );
    expect(screen.getByText('Saved: Nexus + Sanctuary')).toBeTruthy();
    expect(screen.getByTestId('fusion-apply').props.accessibilityState.disabled).toBe(true);
    expect(nexaSpatialLensStore.getSnapshot()).toBe('opportunities');
  });

  it('removes Fusion without modifying the primary World', async () => {
    const { store, screen } = await setup();
    fireEvent.press(screen.getByTestId('fusion-option-bazaar'));
    fireEvent.press(screen.getByTestId('fusion-apply'));
    await waitFor(() => expect(store.getState().worldFusion.discoveryWorld).toBe('bazaar'));

    fireEvent.press(screen.getByTestId('fusion-remove'));
    await waitFor(() => expect(store.getState().worldFusion.discoveryWorld).toBeNull());

    expect(store.getState().worldModes.selectedId).toBe('nexus');
    expect(screen.getByText('No Fusion currently active')).toBeTruthy();
    expect(storage.setItem).toHaveBeenLastCalledWith(
      'g88:world-fusion:v1:user-a',
      JSON.stringify({ version: 1, discoveryWorld: null }),
    );
    expect(nexaSpatialLensStore.getSnapshot()).toBe('map');
  });

  it('surfaces persistence failure in Redux and does not falsely confirm activation', async () => {
    const { screen, store } = await setup();
    storage.setItem.mockRejectedValueOnce(new Error('permission denied'));
    fireEvent.press(screen.getByTestId('fusion-option-diplomat'));
    fireEvent.press(screen.getByTestId('fusion-apply'));

    await waitFor(() => expect(screen.getByTestId('fusion-error')).toBeTruthy());
    expect(screen.getByText('No Fusion currently active')).toBeTruthy();
    expect(store.getState().worldFusion.discoveryWorld).toBeNull();
    expect(screen.queryByText('Saved: Nexus + Diplomat')).toBeNull();
  });

  it('communicates unsupported discovery implementations instead of inventing filters', async () => {
    const { screen } = await setup();
    fireEvent.press(screen.getByTestId('fusion-option-profiler'));
    expect(screen.getByText('No automated discovery lens is implemented for this World.'))
      .toBeTruthy();
    expect(screen.getByText(/no live map data/)).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
