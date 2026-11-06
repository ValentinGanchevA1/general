import AsyncStorage from '@react-native-async-storage/async-storage';
import { configureStore } from '@reduxjs/toolkit';

import reducer, {
  clearWorldFusion,
  hydrateWorldFusion,
  saveWorldFusion,
} from './worldFusionSlice';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

function makeStore() {
  return configureStore({ reducer: { worldFusion: reducer } });
}

describe('World Fusion Redux preference lifecycle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  it('hydrates and saves the secondary World for its authenticated owner', async () => {
    const store = makeStore();
    storage.getItem.mockResolvedValueOnce(JSON.stringify({
      version: 1, discoveryWorld: 'nocturne',
    }));
    await store.dispatch(hydrateWorldFusion('account-a'));
    expect(store.getState().worldFusion).toMatchObject({
      ownerId: 'account-a', hydrated: true, discoveryWorld: 'nocturne',
    });
    await store.dispatch(saveWorldFusion({
      userId: 'account-a', discoveryWorld: 'bazaar',
    }));
    expect(store.getState().worldFusion.discoveryWorld).toBe('bazaar');
    expect(storage.setItem).toHaveBeenCalledWith(
      'g88:world-fusion:v1:account-a',
      JSON.stringify({ version: 1, discoveryWorld: 'bazaar' }),
    );
  });

  it('removes Fusion without modifying primary World or deleting account settings', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldFusion('account-a'));
    await store.dispatch(saveWorldFusion({ userId: 'account-a', discoveryWorld: 'architect' }));
    await store.dispatch(saveWorldFusion({ userId: 'account-a', discoveryWorld: null }));
    expect(store.getState().worldFusion.discoveryWorld).toBeNull();
    expect(storage.setItem).toHaveBeenLastCalledWith(
      'g88:world-fusion:v1:account-a',
      JSON.stringify({ version: 1, discoveryWorld: null }),
    );
  });

  it('does not save a new World when storage fails', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldFusion('account-a'));
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await store.dispatch(saveWorldFusion({ userId: 'account-a', discoveryWorld: 'noir' }));
    expect(store.getState().worldFusion.discoveryWorld).toBeNull();
    expect(store.getState().worldFusion.error).toContain('Could not save');
    expect(store.getState().worldFusion.saving).toBe(false);
  });

  it('rejects saves for another account or before hydration', async () => {
    const store = makeStore();
    await store.dispatch(saveWorldFusion({ userId: 'account-a', discoveryWorld: 'bazaar' }));
    expect(storage.setItem).not.toHaveBeenCalled();
    await store.dispatch(hydrateWorldFusion('account-a'));
    await store.dispatch(saveWorldFusion({ userId: 'account-b', discoveryWorld: 'bazaar' }));
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('prevents two overlapping saves and retains the first confirmed preference', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldFusion('account-a'));
    let finishSave: () => void = () => undefined;
    storage.setItem.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishSave = resolve; }),
    );
    const first = store.dispatch(saveWorldFusion({
      userId: 'account-a', discoveryWorld: 'sanctuary',
    }));
    const second = await store.dispatch(saveWorldFusion({
      userId: 'account-a', discoveryWorld: 'vanguard',
    }));
    expect(second.meta.requestStatus).toBe('rejected');
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    finishSave();
    await first;
    expect(store.getState().worldFusion.discoveryWorld).toBe('sanctuary');
  });

  it('ignores a late hydration from a previous account after switching', async () => {
    const store = makeStore();
    let resolveOld: (value: string | null) => void = () => undefined;
    storage.getItem.mockImplementationOnce(
      () => new Promise<string | null>((resolve) => { resolveOld = resolve; }),
    );
    storage.getItem.mockResolvedValueOnce(JSON.stringify({
      version: 1, discoveryWorld: 'pathfinder',
    }));
    const old = store.dispatch(hydrateWorldFusion('account-a'));
    store.dispatch(clearWorldFusion());
    await store.dispatch(hydrateWorldFusion('account-b'));
    resolveOld(JSON.stringify({ version: 1, discoveryWorld: 'nocturne' }));
    await old;
    expect(store.getState().worldFusion.ownerId).toBe('account-b');
    expect(store.getState().worldFusion.discoveryWorld).toBe('pathfinder');
  });

  it('ignores completion of a pending save after logout', async () => {
    const store = makeStore();
    await store.dispatch(hydrateWorldFusion('account-a'));
    let finishSave: () => void = () => undefined;
    storage.setItem.mockImplementationOnce(
      () => new Promise<void>((resolve) => { finishSave = resolve; }),
    );
    const save = store.dispatch(saveWorldFusion({
      userId: 'account-a', discoveryWorld: 'nocturne',
    }));
    store.dispatch(clearWorldFusion());
    finishSave();
    await save;
    expect(store.getState().worldFusion).toMatchObject({
      ownerId: null, hydrated: false, discoveryWorld: null,
    });
  });
});
