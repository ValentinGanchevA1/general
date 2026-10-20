import type { SubscriptionTier } from '@g88/shared';

import type { ProtosNexusEntitlement, ThemeMode } from './ThemeProvider';

export function canUseProtosNexus(
  tier: SubscriptionTier | null | undefined,
): boolean {
  return tier === 'premium';
}

/**
 * Resolve the effective appearance without destroying the saved preference.
 * `undefined` means membership is still hydrating, so NEXUS is kept temporarily.
 */
export function normalizeThemeMode(
  mode: ThemeMode,
  entitled: ProtosNexusEntitlement,
): ThemeMode {
  return mode === 'protos-nexus' && entitled === false ? 'system' : mode;
}
