import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  readFusionDiscoveryWorld,
  writeFusionDiscoveryWorld,
} from './worldFusionStorage';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('NEXA World Fusion per-account storage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
  });

  it('defaults to no Fusion and never modifies the primary World selection', async () => {
    expect(await readFusionDiscoveryWorld('user-a')).toBeNull();
    await writeFusionDiscoveryWorld('user-a', 'nocturne');
    expect(storage.setItem).toHaveBeenCalledWith(
      'g88:world-fusion:v1:user-a',
      JSON.stringify({ version: 1, discoveryWorld: 'nocturne' }),
    );
    expect(storage.setItem).not.toHaveBeenCalledWith(
      'g88:world-mode:v1:user-a', expect.anything(),
    );
  });

  it('loads a valid secondary World from this account only', async () => {
    storage.getItem.mockResolvedValueOnce(
      JSON.stringify({ version: 1, discoveryWorld: 'bazaar' }),
    );
    expect(await readFusionDiscoveryWorld('account-with-space')).toBe('bazaar');
    expect(storage.getItem).toHaveBeenCalledWith(
      'g88:world-fusion:v1:account-with-space',
    );
    await writeFusionDiscoveryWorld('other-account', 'architect');
    expect(storage.setItem).toHaveBeenCalledWith(
      'g88:world-fusion:v1:other-account',
      JSON.stringify({ version: 1, discoveryWorld: 'architect' }),
    );
  });

  it('ignores invalid JSON, unknown Worlds and later schema versions', async () => {
    for (const value of [
      '{bad json',
      JSON.stringify({ version: 2, discoveryWorld: 'nocturne' }),
      JSON.stringify({ version: 1, discoveryWorld: '__proto__' }),
      JSON.stringify({ version: 1, discoveryWorld: 'protos-nexus' }),
      JSON.stringify({ version: 1, discoveryWorld: 123 }),
      JSON.stringify({ version: 1, discoveryWorld: undefined }),
      JSON.stringify(null),
    ]) {
      storage.getItem.mockResolvedValueOnce(value);
      await expect(readFusionDiscoveryWorld('user-a')).resolves.toBeNull();
    }
  });

  it('supports explicit Fusion removal without deleting the active World', async () => {
    await writeFusionDiscoveryWorld('user-a', null);
    expect(storage.setItem).toHaveBeenCalledWith(
      'g88:world-fusion:v1:user-a',
      JSON.stringify({ version: 1, discoveryWorld: null }),
    );
  });

  it('rejects empty accounts and unvalidated World inputs', async () => {
    await expect(readFusionDiscoveryWorld(' ')).rejects.toThrow();
    await expect(writeFusionDiscoveryWorld(' ', 'nexus')).rejects.toThrow();
    await expect(writeFusionDiscoveryWorld('user-a', '__proto__' as never))
      .rejects.toThrow('Unknown discovery World');
    expect(storage.setItem).not.toHaveBeenCalled();
  });
});
