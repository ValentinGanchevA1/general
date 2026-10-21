import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

import { darkColors, lightColors } from './colors';
import { ThemeProvider, useAppTheme } from './ThemeProvider';

jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const mockUseColorScheme = useColorScheme as jest.MockedFunction<typeof useColorScheme>;

function wrapper({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <ThemeProvider>{children}</ThemeProvider>;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    storage.getItem.mockResolvedValue(null);
    storage.setItem.mockResolvedValue(undefined);
    mockUseColorScheme.mockReturnValue('dark');
  });

  it('follows the OS scheme while mode is system', async () => {
    mockUseColorScheme.mockReturnValue('light');
    const { result } = renderHook(() => useAppTheme(), { wrapper });

    expect(result.current.mode).toBe('system');
    expect(result.current.scheme).toBe('light');
    expect(result.current.colors).toBe(lightColors);

    await waitFor(() => {
      expect(storage.getItem).toHaveBeenCalledWith('g88:theme_preference');
    });
  });

  it('hydrates a persisted explicit mode from storage', async () => {
    storage.getItem.mockResolvedValue('light');
    mockUseColorScheme.mockReturnValue('dark');
    const { result } = renderHook(() => useAppTheme(), { wrapper });

    await waitFor(() => {
      expect(result.current.mode).toBe('light');
    });
    expect(result.current.scheme).toBe('light');
    expect(result.current.colors).toBe(lightColors);
  });

  it('switches mode immediately and persists the preference', async () => {
    const { result } = renderHook(() => useAppTheme(), {
      wrapper: ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider initialMode="dark">{children}</ThemeProvider>
      ),
    });

    expect(result.current.scheme).toBe('dark');
    expect(result.current.colors).toBe(darkColors);

    act(() => {
      result.current.setMode('light');
    });

    expect(result.current.mode).toBe('light');
    expect(result.current.scheme).toBe('light');
    expect(result.current.colors).toBe(lightColors);
    expect(storage.setItem).toHaveBeenCalledWith('g88:theme_preference', 'light');
  });

  it('ignores an invalid persisted value and keeps system mode', async () => {
    storage.getItem.mockResolvedValue('sepia');
    mockUseColorScheme.mockReturnValue('dark');
    const { result } = renderHook(() => useAppTheme(), { wrapper });

    await waitFor(() => {
      expect(storage.getItem).toHaveBeenCalledWith('g88:theme_preference');
    });
    expect(result.current.mode).toBe('system');
    expect(result.current.scheme).toBe('dark');
    expect(result.current.colors).toBe(darkColors);
  });
});
