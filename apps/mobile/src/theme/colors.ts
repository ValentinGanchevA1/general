// Semantic color tokens — light + dark.
// Brand concepts retained: cyan primary, purple accent, green action,
// entity marker colors, premium gold, destructive red.
// No inline hex in screens; consume via useAppTheme() or legacy `colors`.

export type ThemeColors = {
  // Surfaces
  bg: string;
  surface: string;
  surfaceRaised: string;
  surfaceAlt: string;
  border: string;
  borderStrong: string;

  // Brand
  primary: string;
  accent: string;
  info: string;
  action: string;
  onPrimary: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textFaint: string;

  // Status
  danger: string;
  dangerMuted: string;
  dangerSurface: string;
  dangerBorder: string;
  dangerSolid: string;
  primaryTrack: string;
  warning: string;
  success: string;

  // Entity markers (shared across modes — identity on map)
  entityUser: string;
  entityEvent: string;
  entityListing: string;
  entityFriend: string;
  entityWanted: string;

  // Premium
  premium: string;
  premiumBorder: string;
  premiumTier: string;

  // Toast gradient starts
  toastXp: string;
  toastSuccess: string;
  toastAchievement: string;
  toastRank: string;
  toastWave: string;
  toastGift: string;

  shadowInk: string;

  // Tints
  primarySoft: string;
  primaryMutedBg: string;
  primaryGhost: string;
  primaryBorderSoft: string;
  primaryBorder: string;
  premiumSoft: string;
  premiumMutedBg: string;
  premiumBorderSoft: string;
  premiumBorderMid: string;
  dangerBorderSoft: string;
};

/** Current production dark palette (source of truth for dark mode). */
export const darkColors: ThemeColors = {
  bg: '#0a0a0f',
  surface: '#12121f',
  surfaceRaised: '#1a1a24',
  surfaceAlt: '#1a1a2e',
  border: '#1f1f33',
  borderStrong: '#2a2a4a',

  primary: '#00d4ff',
  accent: '#7C5CFF',
  info: '#7ad7ff',
  action: '#34e0a1',
  onPrimary: '#0a0a0f',

  textPrimary: '#ffffff',
  textSecondary: '#aaaaaa',
  textMuted: '#A0A0A0',
  textFaint: '#777777',

  danger: '#ff4444',
  dangerMuted: '#ff6b6b',
  dangerSurface: '#3a1a1a',
  dangerBorder: '#5a1a1a',
  dangerSolid: '#c0392b',
  primaryTrack: '#0095b3',
  warning: '#ff9d3c',
  success: '#4caf50',

  entityUser: '#FF69B4',
  entityEvent: '#FF9800',
  entityListing: '#4CAF50',
  entityFriend: '#2EE6C5',
  entityWanted: '#C084FC',

  premium: '#FFD700',
  premiumBorder: '#FFD70040',
  premiumTier: '#9C27B0',

  toastXp: '#2a1a08',
  toastSuccess: '#0d2818',
  toastAchievement: '#1a1030',
  toastRank: '#0a2030',
  toastWave: '#0a2430',
  toastGift: '#2a1030',

  shadowInk: '#000000',

  primarySoft: 'rgba(0, 212, 255, 0.07)',
  primaryMutedBg: 'rgba(0, 212, 255, 0.09)',
  primaryGhost: 'rgba(0, 212, 255, 0.125)',
  primaryBorderSoft: 'rgba(0, 212, 255, 0.25)',
  primaryBorder: 'rgba(0, 212, 255, 0.4)',
  premiumSoft: 'rgba(255, 215, 0, 0.07)',
  premiumMutedBg: 'rgba(255, 215, 0, 0.09)',
  premiumBorderSoft: 'rgba(255, 215, 0, 0.2)',
  premiumBorderMid: 'rgba(255, 215, 0, 0.4)',
  dangerBorderSoft: 'rgba(255, 107, 107, 0.4)',
};

/** Light palette — same semantic keys; soft neutrals, retained brand hues. */
export const lightColors: ThemeColors = {
  bg: '#F4F5F8',
  surface: '#FFFFFF',
  surfaceRaised: '#F0F1F5',
  surfaceAlt: '#E8EAF0',
  border: '#E2E4EA',
  borderStrong: '#C8CAD4',

  primary: '#0099CC',
  accent: '#6B4FE0',
  info: '#0A8AB8',
  action: '#12B886',
  onPrimary: '#FFFFFF',

  textPrimary: '#111118',
  textSecondary: '#4A4A55',
  textMuted: '#6B6B78',
  textFaint: '#9A9AA8',

  danger: '#E03131',
  dangerMuted: '#C92A2A',
  dangerSurface: '#FFF0F0',
  dangerBorder: '#FFC9C9',
  dangerSolid: '#C0392b',
  primaryTrack: '#66C2E0',
  warning: '#E67700',
  success: '#2F9E44',

  // Entity markers stay vivid on both modes (map identity)
  entityUser: '#FF69B4',
  entityEvent: '#FF9800',
  entityListing: '#4CAF50',
  entityFriend: '#12B886',
  entityWanted: '#9B59B6',

  premium: '#C9A227',
  premiumBorder: '#C9A22740',
  premiumTier: '#7B1FA2',

  toastXp: '#FFF4E0',
  toastSuccess: '#E6F6EC',
  toastAchievement: '#F0E8FF',
  toastRank: '#E6F4FF',
  toastWave: '#E6F7FC',
  toastGift: '#FCE8FF',

  shadowInk: '#000000',

  primarySoft: 'rgba(0, 153, 204, 0.08)',
  primaryMutedBg: 'rgba(0, 153, 204, 0.1)',
  primaryGhost: 'rgba(0, 153, 204, 0.14)',
  primaryBorderSoft: 'rgba(0, 153, 204, 0.22)',
  primaryBorder: 'rgba(0, 153, 204, 0.35)',
  premiumSoft: 'rgba(201, 162, 39, 0.08)',
  premiumMutedBg: 'rgba(201, 162, 39, 0.1)',
  premiumBorderSoft: 'rgba(201, 162, 39, 0.2)',
  premiumBorderMid: 'rgba(201, 162, 39, 0.35)',
  dangerBorderSoft: 'rgba(224, 49, 49, 0.35)',
};
