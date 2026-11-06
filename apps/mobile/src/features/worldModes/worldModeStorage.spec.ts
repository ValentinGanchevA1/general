import AsyncStorage from '@react-native-async-storage/async-storage';

import { readWorldMode, writeWorldMode } from './worldModeStorage';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('World Mode storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  it('defaults to nexus for missing or invalid IDs', async () => {
    expect(await readWorldMode('user-a')).toBe('nexus');
    storage.getItem.mockResolvedValue('protos-nexus');
    expect(await readWorldMode('user-a')).toBe('nexus');
  });

  it('persists only the selected mode under the owning account', async () => {
    await writeWorldMode('user-a', 'sanctuary');
    expect(storage.setItem).toHaveBeenCalledWith('g88:world-mode:v1:user-a', 'sanctuary');
    storage.getItem.mockResolvedValue('sanctuary');
    expect(await readWorldMode('user-a')).toBe('sanctuary');
    expect(storage.getItem).toHaveBeenCalledWith('g88:world-mode:v1:user-a');
  });

  it('rejects empty account identifiers', async () => {
    await expect(readWorldMode(' ')).rejects.toThrow();
  });
});