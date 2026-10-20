import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getInboxSeenAt,
  hydrateInboxSeen,
  isInboxSeenHydrated,
  markInboxSeen,
  resetInboxSeen,
} from './inboxSeen';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('inboxSeen persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetInboxSeen();
  });

  it('hydrates a watermark for the active account', async () => {
    storage.getItem.mockResolvedValue('1234');

    await hydrateInboxSeen('user-a');

    expect(storage.getItem).toHaveBeenCalledWith('@g88/interactions-seen/v1/user-a');
    expect(getInboxSeenAt()).toBe(1234);
    expect(isInboxSeenHydrated()).toBe(true);
  });

  it('persists explicit progress without moving the watermark backwards', async () => {
    storage.getItem.mockResolvedValue('1000');
    await hydrateInboxSeen('user-a');

    markInboxSeen(2000);
    markInboxSeen(1500);

    expect(getInboxSeenAt()).toBe(2000);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(storage.setItem).toHaveBeenCalledWith('@g88/interactions-seen/v1/user-a', '2000');
  });

  it('does not leak a previous account watermark during an account switch', async () => {
    storage.getItem.mockImplementation(async (key: string) =>
      key.endsWith('user-a') ? '5000' : '700',
    );

    await hydrateInboxSeen('user-a');
    expect(getInboxSeenAt()).toBe(5000);

    await hydrateInboxSeen('user-b');
    expect(getInboxSeenAt()).toBe(700);
  });

  it('ignores a stale hydration result after switching accounts', async () => {
    let resolveA: ((value: string | null) => void) | undefined;
    storage.getItem.mockImplementation((key: string) => {
      if (key.endsWith('user-a')) {
        return new Promise<string | null>((resolve) => {
          resolveA = resolve;
        });
      }
      return Promise.resolve('900');
    });

    const hydrateA = hydrateInboxSeen('user-a');
    await hydrateInboxSeen('user-b');
    resolveA?.('8000');
    await hydrateA;

    expect(getInboxSeenAt()).toBe(900);
    expect(isInboxSeenHydrated()).toBe(true);
  });
});
