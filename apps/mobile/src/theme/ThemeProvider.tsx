import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { darkColors, lightColors, protosNexusColors, type ThemeColors } from './colors';
import { fontSize, layout, radius, spacing } from './tokens';

const THEME_PREF_KEY = 'g88:theme_preference';

export type ThemeMode = 'light' | 'dark' | 'system' | 'protos-nexus';
export type ResolvedScheme = 'light' | 'dark';
export type ProtosNexusEntitlement = boolean | undefined;

export type Theme = {
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  fontSize: typeof fontSize;
  layout: typeof layout;
  scheme: ResolvedScheme;
  mode: ThemeMode;
  /**
   * Elevation helper — prefer tokens over raw #000.
   * PROTOS NEXUS uses a restrained pink glow; standard themes are unchanged.
   */
  shadow: (opacity?: number) => {
    shadowColor: string;
    shadowOpacity: number;
    shadowRadius: number;
    shadowOffset: { width: number; height: number };
    elevation: number;
  };
};

type ThemeContextValue = Theme & {
  setMode: (mode: ThemeMode) => void;
  /** undefined while membership is still hydrating. */
  canUseProtosNexus: ProtosNexusEntitlement;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(
  mode: ThemeMode,
  system: ResolvedScheme | null | undefined,
): ResolvedScheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark' || mode === 'protos-nexus') return 'dark';
  return system === 'light' ? 'light' : 'dark';
}

function buildTheme(scheme: ResolvedScheme, mode: ThemeMode): Theme {
  const colors =
    mode === 'protos-nexus'
      ? protosNexusColors
      : scheme === 'light'
        ? lightColors
        : darkColors;

  return {
    colors,
    spacing,
    radius,
    fontSize,
    layout,
    scheme,
    mode,
    shadow: (opacity?: number) => ({
      shadowColor: colors.shadowInk,
      shadowOpacity:
        opacity ?? (mode === 'protos-nexus' ? 0.38 : scheme === 'light' ? 0.08 : 0.25),
      shadowRadius: mode === 'protos-nexus' ? 16 : 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: mode === 'protos-nexus' ? 8 : 6,
    }),
  };
}

export interface ThemeProviderProps {
  children: React.ReactNode;
  /** Override initial mode (tests). Default: system, then hydrate from storage. */
  initialMode?: ThemeMode;
  /** undefined = membership has not finished hydrating yet. */
  canUseProtosNexus?: ProtosNexusEntitlement;
}

export function ThemeProvider({
  children,
  initialMode = 'system',
  canUseProtosNexus,
}: ThemeProviderProps): React.JSX.Element {
  const systemScheme = useColorScheme();
  const [preferredMode, setPreferredMode] = useState<ThemeMode>(initialMode);
  const [hydrated, setHydrated] = useState(initialMode !== 'system');

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_PREF_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (
          raw === 'light' ||
          raw === 'dark' ||
          raw === 'system' ||
          raw === 'protos-nexus'
        ) {
          setPreferredMode(raw);
        }
        setHydrated(true);
      })
      .catch(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback(
    (next: ThemeMode) => {
      if (next === 'protos-nexus' && canUseProtosNexus !== true) return;
      setPreferredMode(next);
      void AsyncStorage.setItem(THEME_PREF_KEY, next).catch(() => {
        // preference is best-effort
      });
    },
    [canUseProtosNexus],
  );

  // Preserve the premium preference in storage. A confirmed downgrade only changes
  // the effective mode, so renewal can restore NEXUS without mutating user settings.
  const mode: ThemeMode =
    preferredMode === 'protos-nexus' && canUseProtosNexus === false
      ? 'system'
      : preferredMode;

  const scheme = resolveScheme(
    mode,
    systemScheme === 'light' || systemScheme === 'dark' ? systemScheme : 'dark',
  );

  const value = useMemo<ThemeContextValue>(() => {
    const base = buildTheme(scheme, mode);
    return { ...base, setMode, canUseProtosNexus };
  }, [scheme, mode, setMode, canUseProtosNexus]);

  // Avoid flash: until storage hydrates, still render with system/default.
  void hydrated;

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Typed theme hook. Prefer this over static `colors` for new/refactored UI.
 * Falls back to dark theme if used outside provider (legacy screens during migration).
 */
export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;

  const fallback = buildTheme('dark', 'dark');
  return {
    ...fallback,
    canUseProtosNexus: false,
    setMode: () => {
      if (__DEV__) {
        // eslint-disable-next-line no-console
        console.warn('useAppTheme: setMode called outside ThemeProvider');
      }
    },
  };
}

/** Subscribe to OS scheme changes when mode === 'system' (optional helper). */
export function useSystemSchemeListener(onChange: (scheme: ResolvedScheme) => void): void {
  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      onChange(colorScheme === 'light' ? 'light' : 'dark');
    });
    return () => sub.remove();
  }, [onChange]);
}
