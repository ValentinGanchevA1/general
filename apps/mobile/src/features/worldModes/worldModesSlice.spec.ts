import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';

import reducer, {
  activateWorldMode,
  clearWorldMode,
  hydrateWorldMode,
} from './worldModesSlice';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function makeStore() {
  return configureStore({ reducer: { worldModes: reducer } });
}

describe('World Mode preference state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  it('hydrates the account preference and persists activation', async () => {
    const store = makeStore();
    storage.getItem.mockResolvedValue('nocturne');
    await store.dispatch(hydrateWorldMode('user-a'));
    expect(store.getState().worldModes.selectedId).toBe('nocturne');
    expect(store.getState().worldModes.hydrated).toBe(true);

    await store.dispatch(activateWorldMode({ userId: 'user-a', id: 'pathfinder' }));
    expect(store.getState().worldModes.selectedId).toBe('pathfinder');
    expect(store.getState().worldModes.error).toBeNull();
    store.dispatch(clearWorldMode());
    expect(store.getState().worldModes.selectedId).toBe('nexus');
    expect(store.getState().worldModes.ownerId).toBeNull();
  });

  it('retains the previous selection when storage write fails', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldMode('user-a'));
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await store.dispatch(activateWorldMode({ userId: 'user-a', id: 'bazaar' }));
    expect(store.getState().worldModes.selectedId).toBe('nexus');
    expect(store.getState().worldModes.error).toContain('Could not save');
  });

  it('ignores an activation for an unrelated account', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldMode('user-a'));
    await store.dispatch(activateWorldMode({ userId: 'user-b', id: 'vanguard' }));
    expect(store.getState().worldModes.selectedId).toBe('nexus');
  });
});