import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  markWorldSelectionPending,
  persistFirstRunWorldSelection,
  readWorldMode,
  readWorldSelectionPending,
  writeWorldMode,
} from './worldModeStorage';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('World Mode storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    storage.removeItem.mockResolvedValue(undefined);
  });

  it('defaults to NEXUS for missing or invalid IDs', async () => {
    expect(await readWorldMode('user-a')).toBe('nexus');
    storage.getItem.mockResolvedValue('protos-nexus');
    expect(await readWorldMode('user-a')).toBe('nexus');
  });

  it('persists a mode under the owning account', async () => {
    await writeWorldMode('user-a', 'sanctuary');
    expect(storage.setItem).toHaveBeenCalledWith('g88:world-mode:v1:user-a', 'sanctuary');
  });

  it('scopes the first-run marker to the registering account', async () => {
    await markWorldSelectionPending('user-a');
    storage.getItem.mockResolvedValueOnce('1');
    expect(await readWorldSelectionPending('user-a')).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith('g88:world-mode-first-run:v1:user-a', '1');
  });

  it('persists the chosen mode before clearing the first-run marker', async () => {
    await persistFirstRunWorldSelection('user-a', 'nocturne');
    expect(storage.setItem).toHaveBeenCalledWith('g88:world-mode:v1:user-a', 'nocturne');
    expect(storage.removeItem).toHaveBeenCalledWith('g88:world-mode-first-run:v1:user-a');
  });

  it('continues when marker cleanup fails after the mode has been saved', async () => {
    storage.removeItem.mockRejectedValueOnce(new Error('cleanup unavailable'));
    await expect(persistFirstRunWorldSelection('user-a', 'nocturne')).resolves.toBeUndefined();
    expect(storage.setItem).toHaveBeenCalledWith('g88:world-mode:v1:user-a', 'nocturne');
  });

  it('does not clear the first-run marker when saving the mode fails', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('storage unavailable'));
    await expect(persistFirstRunWorldSelection('user-a', 'bazaar')).rejects.toThrow();
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('rejects empty account identifiers', async () => {
    await expect(readWorldMode(' ')).rejects.toThrow();
    await expect(markWorldSelectionPending(' ')).rejects.toThrow();
  });
});
