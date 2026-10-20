import type { ThemeMode } from './ThemeProvider';

export type SubscriptionTier = 'free' | 'basic' | 'premium';

export function canUseProtosNexus(tier: SubscriptionTier | null | undefined): boolean {
  return tier === 'premium';
}

export function normalizeThemeMode(mode: ThemeMode, entitled: boolean): ThemeMode {
  return mode === 'protos-nexus' && !entitled ? 'system' : mode;
}
