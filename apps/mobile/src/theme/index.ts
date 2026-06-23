// apps/mobile/src/theme/index.ts
//
// Phase-0 design tokens. Extracted from the values that were already in use
// inline across screens (no visual change intended) so a UX pass can converge
// on one source of truth instead of re-declaring hexes per StyleSheet.
//
// Adoption is incremental: new/edited components should import from here;
// existing screens get migrated as they're touched. Do NOT mass-rewrite every
// StyleSheet in one commit — that collides with parallel work and buries real
// diffs.

export const colors = {
  /** App background (near-black). */
  bg: '#0a0a0f',
  /** Card / panel surface. */
  surface: '#12121f',
  /** Slightly raised surface (rows, pills, inputs). */
  surfaceRaised: '#1a1a24',
  /** Alt surface used by some overlays/markers. */
  surfaceAlt: '#1a1a2e',
  /** Hairline border. */
  border: '#1f1f33',
  /** Stronger border / outline. */
  borderStrong: '#2a2a4a',

  /** Brand accent (cyan). */
  primary: '#00d4ff',
  /** Text/!icon color when placed on top of `primary`. */
  onPrimary: '#0a0a0f',

  textPrimary: '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted: '#888888',
  textFaint: '#555555',

  danger: '#ff4444',
  warning: '#ff9d3c',
  success: '#4caf50',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 24,
  /** Standard 56dp FAB radius. */
  fab: 28,
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
} as const;

/** Standard elevated-control shadow (FAB, sheets). */
export const shadow = {
  fab: {
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
} as const;

export const theme = { colors, spacing, radius, fontSize, shadow } as const;
export type Theme = typeof theme;
