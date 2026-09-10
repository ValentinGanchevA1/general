// apps/mobile/src/theme/index.ts
//
// Phase-0 design tokens. Extracted from the values that were already in use
// inline across screens (no visual change intended) so a UX pass can converge
// on one source of truth instead of re-declaring hexes per StyleSheet.
//
// Adoption: most UI StyleSheets now import tokens from here. Remaining
// intentional hex: Google Maps style JSON (mapStyle.ts), third-party brand
// colours (socialConfig providers), ambient toast gradient tints, shadowColor #000.

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
  /** Secondary brand (stories rings / CTAs). */
  accent: '#7C5CFF',
  /** Soft info / shared-goal highlight. */
  info: '#7ad7ff',
  /** Action green (message / positive CTA). */
  action: '#34e0a1',
  /** Text/!icon color when placed on top of `primary`. */
  onPrimary: '#0a0a0f',

  textPrimary: '#ffffff',
  textSecondary: '#aaaaaa',
  /** Secondary labels / hints — lightened for dark-mode readability (was #888). */
  textMuted: '#A0A0A0',
  /** Faintest supporting text (chevrons, placeholders). */
  textFaint: '#777777',

  danger: '#ff4444',
  /** Softer danger for text (logout, form errors). */
  dangerMuted: '#ff6b6b',
  /** Danger surface / border for logout & destructive rows. */
  dangerSurface: '#3a1a1a',
  dangerBorder: '#5a1a1a',
  /** Solid destructive button (confirm delete). */
  dangerSolid: '#c0392b',
  /** Switch track when on (slightly dimmed primary). */
  primaryTrack: '#0095b3',
  warning: '#ff9d3c',
  success: '#4caf50',

  /** Map / discovery: people pins (non-friend). */
  entityUser: '#FF69B4',
  /** Map / discovery: events. */
  entityEvent: '#FF9800',
  /** Map / discovery: listings for sale. */
  entityListing: '#4CAF50',
  /**
   * Map / discovery + avatar rings: close-friend identity.
   * Dedicated teal — distinct from brand primary cyan and action green.
   */
  entityFriend: '#2EE6C5',
  /** Map / discovery: wanted / looking-to-buy listings (distinct from friends). */
  entityWanted: '#C084FC',

  /** Premium / subscription gold. */
  premium: '#FFD700',
  /** Premium border with alpha. */
  premiumBorder: '#FFD70040',
  /** Premium tier purple (subscription badge). */
  premiumTier: '#9C27B0',

  /** Translucent primary tints (chips, selected rows). */
  primarySoft: 'rgba(0, 212, 255, 0.07)',
  primaryMutedBg: 'rgba(0, 212, 255, 0.09)',
  primaryGhost: 'rgba(0, 212, 255, 0.125)',
  primaryBorderSoft: 'rgba(0, 212, 255, 0.25)',
  primaryBorder: 'rgba(0, 212, 255, 0.4)',
  /** Translucent premium tints. */
  premiumSoft: 'rgba(255, 215, 0, 0.07)',
  premiumMutedBg: 'rgba(255, 215, 0, 0.09)',
  premiumBorderSoft: 'rgba(255, 215, 0, 0.2)',
  premiumBorderMid: 'rgba(255, 215, 0, 0.4)',
  /** Translucent danger. */
  dangerBorderSoft: 'rgba(255, 107, 107, 0.4)',
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
