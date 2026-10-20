import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, protosNexusColors, type ThemeColors } from './colors';
import { fontSize, layout, radius, spacing } from './tokens';

const THEME_PREF_KEY = 'g88:theme_preference';
export type ThemeMode = 'light' | 'dark' | 'system' | 'protos-nexus';
export type ResolvedScheme = 'light' | 'dark';
export type Theme = { colors: ThemeColors; spacing: typeof spacing; radius: typeof radius; fontSize: typeof fontSize; layout: typeof layout; scheme: ResolvedScheme; mode: ThemeMode; shadow: (opacity?: number) => { shadowColor: string; shadowOpacity: number; shadowRadius: number; shadowOffset: { width: number; height: number }; elevation: number } };
type ThemeContextValue = Theme & { setMode: (mode: ThemeMode) => void; canUseProtosNexus: boolean };
const ThemeContext = createContext<ThemeContextValue | null>(null);

function resolveScheme(mode: ThemeMode, system: ResolvedScheme | null | undefined): ResolvedScheme {
  if (mode === 'light') return 'light';
  if (mode === 'dark' || mode === 'protos-nexus') return 'dark';
  return system === 'light' ? 'light' : 'dark';
}
function buildTheme(scheme: ResolvedScheme, mode: ThemeMode): Theme {
  const colors = mode === 'protos-nexus' ? protosNexusColors : scheme === 'light' ? lightColors : darkColors;
  return { colors, spacing, radius, fontSize, layout, scheme, mode, shadow: (opacity?: number) => ({ shadowColor: colors.shadowInk, shadowOpacity: opacity ?? (mode === 'protos-nexus' ? 0.38 : scheme === 'light' ? 0.08 : 0.25), shadowRadius: mode === 'protos-nexus' ? 16 : 12, shadowOffset: { width: 0, height: 4 }, elevation: mode === 'protos-nexus' ? 8 : 6 }) };
}
export interface ThemeProviderProps { children: React.ReactNode; initialMode?: ThemeMode; canUseProtosNexus?: boolean }
export function ThemeProvider({ children, initialMode = 'system', canUseProtosNexus = false }: ThemeProviderProps): React.JSX.Element {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(initialMode);
  const [hydrated, setHydrated] = useState(initialMode !== 'system');
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_PREF_KEY).then((raw) => {
      if (cancelled) return;
      const stored: ThemeMode | null = raw === 'light' || raw === 'dark' || raw === 'system' || raw === 'protos-nexus' ? raw : null;
      if (stored) setModeState(stored === 'protos-nexus' && !canUseProtosNexus ? 'system' : stored);
      setHydrated(true);
    }).catch(() => { if (!cancelled) setHydrated(true); });
    return () => { cancelled = true; };
  }, [canUseProtosNexus]);
  useEffect(() => {
    if (mode === 'protos-nexus' && !canUseProtosNexus) {
      setModeState('system');
      void AsyncStorage.setItem(THEME_PREF_KEY, 'system').catch(() => undefined);
    }
  }, [canUseProtosNexus, mode]);
  const setMode = useCallback((next: ThemeMode) => {
    const allowed = next !== 'protos-nexus' || canUseProtosNexus;
    const resolved: ThemeMode = allowed ? next : 'system';
    setModeState(resolved);
    void AsyncStorage.setItem(THEME_PREF_KEY, resolved).catch(() => undefined);
  }, [canUseProtosNexus]);
  const scheme = resolveScheme(mode, systemScheme === 'light' || systemScheme === 'dark' ? systemScheme : 'dark');
  const value = useMemo<ThemeContextValue>(() => ({ ...buildTheme(scheme, mode), setMode, canUseProtosNexus }), [scheme, mode, setMode, canUseProtosNexus]);
  void hydrated;
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (ctx) return ctx;
  return { ...buildTheme('dark', 'dark'), canUseProtosNexus: false, setMode: () => { if (__DEV__) console.warn('useAppTheme: setMode called outside ThemeProvider'); } };
}
export function useSystemSchemeListener(onChange: (scheme: ResolvedScheme) => void): void {
  useEffect(() => { const sub = Appearance.addChangeListener(({ colorScheme }) => onChange(colorScheme === 'light' ? 'light' : 'dark')); return () => sub.remove(); }, [onChange]);
}
