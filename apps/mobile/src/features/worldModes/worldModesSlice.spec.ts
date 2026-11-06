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

describe('World Mode async race protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  it('deduplicates hydration for the same signed-in account', async () => {
    const store = makeStore();
    let finishRead: (mode: string | null) => void = () => undefined;
    storage.getItem.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => { finishRead = resolve; }),
    );

    const original = store.dispatch(hydrateWorldMode('user-a'));
    const duplicate = await store.dispatch(hydrateWorldMode('user-a'));
    expect(duplicate.meta.requestStatus).toBe('rejected');
    expect(storage.getItem).toHaveBeenCalledTimes(1);

    finishRead('noir');
    await original;
    expect(store.getState().worldModes.selectedId).toBe('noir');
    expect(store.getState().worldModes.hydrated).toBe(true);

    const repeat = await store.dispatch(hydrateWorldMode('user-a'));
    expect(repeat.meta.requestStatus).toBe('rejected');
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it('does not reset a pending activation when hydration is requested again', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldMode('user-a'));
    let finishSave: () => void = () => undefined;
    storage.setItem.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishSave = resolve; }),
    );

    const save = store.dispatch(activateWorldMode({ userId: 'user-a', id: 'nocturne' }));
    expect(store.getState().worldModes.saving).toBe(true);
    await store.dispatch(hydrateWorldMode('user-a'));
    expect(store.getState().worldModes.saving).toBe(true);
    finishSave();
    await save;
    expect(store.getState().worldModes.selectedId).toBe('nocturne');
    expect(store.getState().worldModes.saving).toBe(false);
    expect(storage.getItem).toHaveBeenCalledTimes(1);
  });

  it('ignores a late hydration from a previous account', async () => {
    const store = makeStore();
    let resolveOld: (value: string | null) => void = () => undefined;
    storage.getItem.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => { resolveOld = resolve; }),
    );
    storage.getItem.mockResolvedValueOnce('sanctuary');

    const oldRead = store.dispatch(hydrateWorldMode('user-a'));
    await store.dispatch(hydrateWorldMode('user-b'));
    resolveOld('vanguard');
    await oldRead;
    expect(store.getState().worldModes.ownerId).toBe('user-b');
    expect(store.getState().worldModes.selectedId).toBe('sanctuary');
  });

  it('does not write while loading or for a mismatched account', async () => {
    const store = makeStore();
    await store.dispatch(activateWorldMode({ userId: 'user-a', id: 'vanguard' }));
    expect(storage.setItem).not.toHaveBeenCalled();

    await store.dispatch(hydrateWorldMode('user-a'));
    await store.dispatch(activateWorldMode({ userId: 'user-b', id: 'vanguard' }));
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('rejects a parallel activation before a second storage write occurs', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldMode('user-a'));

    let resolveSave: () => void = () => undefined;
    storage.setItem.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveSave = resolve;
    }));

    const first = store.dispatch(activateWorldMode({ userId: 'user-a', id: 'pathfinder' }));
    const second = await store.dispatch(activateWorldMode({ userId: 'user-a', id: 'noir' }));
    expect(second.meta.requestStatus).toBe('rejected');
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    resolveSave();
    await first;
    expect(store.getState().worldModes.selectedId).toBe('pathfinder');
  });
});
