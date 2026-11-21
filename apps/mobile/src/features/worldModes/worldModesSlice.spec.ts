import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';

import reducer, {
  activateWorldMode,
  clearWorldMode,
  completeFirstRunWorldSelection,
  hydrateWorldMode,
  skipWorldSelectionForSession,
  finishFirstRunWorldSelection,
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
    storage.removeItem.mockResolvedValue(undefined);
  });

  it('hydrates an account preference and its first-run marker', async () => {
    const store = makeStore();
    storage.getItem
      .mockResolvedValueOnce('nocturne')
      .mockResolvedValueOnce('1');

    await store.dispatch(hydrateWorldMode('user-a'));
    expect(store.getState().worldModes.selectedId).toBe('nocturne');
    expect(store.getState().worldModes.firstRunPending).toBe(true);
    expect(store.getState().worldModes.hydrated).toBe(true);
  });

  it('persists and completes first-run selection', async () => {
    const store = makeStore();
    storage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce('1');
    await store.dispatch(hydrateWorldMode('user-a'));

    await store.dispatch(completeFirstRunWorldSelection({ userId: 'user-a', id: 'sanctuary' }));
    expect(store.getState().worldModes.selectedId).toBe('sanctuary');
    expect(store.getState().worldModes.firstRunPending).toBe(true);
    expect(store.getState().worldModes.error).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('g88:world-mode-first-run:v1:user-a');
    store.dispatch(finishFirstRunWorldSelection());
    expect(store.getState().worldModes.firstRunPending).toBe(false);
  });

  it('keeps the prior selection and first-run marker when persistence fails', async () => {
    const store = makeStore();
    storage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce('1');
    await store.dispatch(hydrateWorldMode('user-a'));
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await store.dispatch(completeFirstRunWorldSelection({ userId: 'user-a', id: 'bazaar' }));
    expect(store.getState().worldModes.selectedId).toBe('nexus');
    expect(store.getState().worldModes.firstRunPending).toBe(true);
    expect(store.getState().worldModes.error).toContain('Could not save');
  });

  it('keeps the previous selection when settings activation fails', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldMode('user-a'));
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));

    await store.dispatch(activateWorldMode({ userId: 'user-a', id: 'bazaar' }));
    expect(store.getState().worldModes.selectedId).toBe('nexus');
    expect(store.getState().worldModes.error).toContain('Could not save');
  });

  it('ignores writes from a different account', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldMode('user-a'));
    await store.dispatch(activateWorldMode({ userId: 'user-b', id: 'vanguard' }));
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('clears private in-memory state when the account is reset', async () => {
    const store = makeStore();
    storage.getItem.mockResolvedValueOnce('nocturne').mockResolvedValueOnce('1');
    await store.dispatch(hydrateWorldMode('user-a'));
    store.dispatch(clearWorldMode());
    expect(store.getState().worldModes.selectedId).toBe('nexus');
    expect(store.getState().worldModes.ownerId).toBeNull();
    expect(store.getState().worldModes.firstRunPending).toBe(false);
  });

  it('allows session-only skip when local storage is unavailable', async () => {
    const store = makeStore();
    storage.getItem.mockResolvedValueOnce(null).mockResolvedValueOnce('1');
    await store.dispatch(hydrateWorldMode('user-a'));
    expect(store.getState().worldModes.firstRunPending).toBe(true);
    store.dispatch(skipWorldSelectionForSession());
    expect(store.getState().worldModes.firstRunPending).toBe(true);
    expect(store.getState().worldModes.selectedId).toBe('nexus');
    store.dispatch(finishFirstRunWorldSelection());
    expect(store.getState().worldModes.firstRunPending).toBe(false);
  });
});

describe('World Mode async race protection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    storage.removeItem.mockResolvedValue(undefined);
  });

  it('deduplicates hydration for the same account', async () => {
    const store = makeStore();
    let finishRead: (value: string | null) => void = () => undefined;
    storage.getItem.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => { finishRead = resolve; }),
    );
    storage.getItem.mockResolvedValueOnce(null);

    const original = store.dispatch(hydrateWorldMode('user-a'));
    const duplicate = await store.dispatch(hydrateWorldMode('user-a'));
    expect(duplicate.meta.requestStatus).toBe('rejected');
    expect(storage.getItem).toHaveBeenCalledTimes(2);

    finishRead('noir');
    await original;
    expect(store.getState().worldModes.selectedId).toBe('noir');
    expect(store.getState().worldModes.hydrated).toBe(true);
  });

  it('ignores a late hydration from a previous account', async () => {
    const store = makeStore();
    let resolveOldMode: (value: string | null) => void = () => undefined;
    storage.getItem.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => { resolveOldMode = resolve; }),
    );
    storage.getItem.mockResolvedValueOnce(null);
    storage.getItem.mockResolvedValueOnce('sanctuary');
    storage.getItem.mockResolvedValueOnce(null);

    const oldRead = store.dispatch(hydrateWorldMode('user-a'));
    await store.dispatch(hydrateWorldMode('user-b'));
    resolveOldMode('vanguard');
    await oldRead;

    expect(store.getState().worldModes.ownerId).toBe('user-b');
    expect(store.getState().worldModes.selectedId).toBe('sanctuary');
  });

  it('prevents parallel writes', async () => {
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
