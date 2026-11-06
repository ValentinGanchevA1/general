import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native';
import { Provider } from 'react-redux';

import { nexaSpatialLensStore } from '@/features/map/nexaSpatialLens.store';
import { nexaMapFilterIntentStore } from '@/features/map/nexaMapFilterIntent.store';
import { navigationRef } from '@/navigation/navigationRef';
import worldModesReducer, { hydrateWorldMode } from './worldModesSlice';
import worldFusionReducer, { hydrateWorldFusion } from './worldFusionSlice';
import { WorldFusionScreen } from './WorldFusionScreen';

jest.mock('@/navigation/navigationRef', () => ({
  navigationRef: {
    isReady: jest.fn(() => true),
    navigate: jest.fn(),
  },
}));
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
    nexaMapFilterIntentStore.reset();
    jest.mocked(navigationRef.isReady).mockReturnValue(true);
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
    act(() => nexaSpatialLensStore.set('opportunities'));
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

  it('disables selection and repeated Apply while the storage write is pending', async () => {
    const { screen, store } = await setup();
    let finishSave: () => void = () => undefined;
    storage.setItem.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishSave = resolve; }),
    );
    fireEvent.press(screen.getByTestId('fusion-option-nocturne'));
    fireEvent.press(screen.getByTestId('fusion-apply'));

    await waitFor(() => expect(store.getState().worldFusion.saving).toBe(true));
    expect(screen.getByTestId('fusion-apply').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByTestId('fusion-option-bazaar').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('fusion-apply'));
    fireEvent.press(screen.getByTestId('fusion-option-bazaar'));
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Nocturne discovery inspiration')).toBeTruthy();
    await act(async () => { finishSave(); });
    await waitFor(() => expect(store.getState().worldFusion.discoveryWorld).toBe('nocturne'));
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

  it('opens an existing lens only after saved Fusion and a second explicit tap', async () => {
    const { screen, store } = await setup();
    act(() => nexaMapFilterIntentStore.publish(false));
    fireEvent.press(screen.getByTestId('fusion-option-nocturne'));
    expect(screen.queryByTestId('fusion-open-lens')).toBeNull();
    fireEvent.press(screen.getByTestId('fusion-apply'));
    await waitFor(() => expect(store.getState().worldFusion.discoveryWorld).toBe('nocturne'));
    const button = screen.getByTestId('fusion-open-lens');
    expect(button.props.accessibilityState.disabled).toBe(false);
    expect(nexaSpatialLensStore.getSnapshot()).toBe('map');
    expect(navigationRef.navigate).not.toHaveBeenCalled();

    fireEvent.press(button);
    expect(nexaSpatialLensStore.getSnapshot()).toBe('experiences');
    expect(navigationRef.navigate).toHaveBeenCalledWith('Main', { screen: 'Map' });
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });

  it('refuses switching when manual filters are active or the map was not initialized', async () => {
    const { screen, store } = await setup();
    fireEvent.press(screen.getByTestId('fusion-option-bazaar'));
    fireEvent.press(screen.getByTestId('fusion-apply'));
    await waitFor(() => expect(store.getState().worldFusion.discoveryWorld).toBe('bazaar'));

    expect(screen.getByTestId('fusion-open-lens').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/Open the Map once to verify/)).toBeTruthy();

    act(() => nexaMapFilterIntentStore.publish(true));
    expect(screen.getByText(/Manual map filters are active/)).toBeTruthy();
    expect(screen.getByTestId('fusion-open-lens').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('fusion-open-lens'));
    expect(navigationRef.navigate).not.toHaveBeenCalled();
    expect(nexaSpatialLensStore.getSnapshot()).toBe('map');
  });

  it('respects an already selected spatial lens even without manual filters', async () => {
    const { screen, store } = await setup();
    act(() => nexaMapFilterIntentStore.publish(false));
    fireEvent.press(screen.getByTestId('fusion-option-bazaar'));
    fireEvent.press(screen.getByTestId('fusion-apply'));
    await waitFor(() => expect(store.getState().worldFusion.discoveryWorld).toBe('bazaar'));

    act(() => nexaSpatialLensStore.set('experiences'));
    expect(screen.getByTestId('fusion-open-lens').props.accessibilityState.disabled).toBe(true);
    expect(screen.getByText(/Your selected map lens has priority/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('fusion-open-lens'));
    expect(nexaSpatialLensStore.getSnapshot()).toBe('experiences');
    expect(navigationRef.navigate).not.toHaveBeenCalled();
  });

  it('does not offer a lens shortcut for unsupported World discovery filters', async () => {
    const { screen, store } = await setup();
    act(() => nexaMapFilterIntentStore.publish(false));
    fireEvent.press(screen.getByTestId('fusion-option-sanctuary'));
    fireEvent.press(screen.getByTestId('fusion-apply'));
    await waitFor(() => expect(store.getState().worldFusion.discoveryWorld).toBe('sanctuary'));

    expect(screen.queryByTestId('fusion-open-lens')).toBeNull();
    expect(nexaSpatialLensStore.getSnapshot()).toBe('map');
  });

  it('does not navigate when the root navigator is not ready', async () => {
    const { screen, store } = await setup();
    act(() => nexaMapFilterIntentStore.publish(false));
    jest.mocked(navigationRef.isReady).mockReturnValue(false);
    fireEvent.press(screen.getByTestId('fusion-option-nocturne'));
    fireEvent.press(screen.getByTestId('fusion-apply'));
    await waitFor(() => expect(store.getState().worldFusion.discoveryWorld).toBe('nocturne'));

    expect(screen.getByTestId('fusion-open-lens').props.accessibilityState.disabled).toBe(true);
    expect(navigationRef.navigate).not.toHaveBeenCalled();
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
