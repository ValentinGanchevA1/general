// Canonical NEXA brand primitives.
//
// These values are mode-independent brand identity. Theme-aware semantic colors
// are composed in colors.ts. Feature code should prefer useAppTheme().colors
// instead of importing primitives directly.

export const nexaBrand = {
  violet: '#7C5CFC',
  violetBright: '#9278FF',
  violetMuted: '#5B45C8',
  cyan: '#27D3F2',
  cyanBright: '#62E6FF',
  cyanMuted: '#147E93',
} as const;

export const nexaDark = {
  canvas: '#08090D',
  mapBase: '#0A0C11',
  surfacePrimary: '#101218',
  surfaceSecondary: '#151821',
  surfaceTertiary: '#1B1F29',
  surfaceHover: '#202530',

  textPrimary: '#F7F8FA',
  textSecondary: '#B0B5C0',
  textTertiary: '#777E8D',
  textDisabled: '#555B67',
  textInverse: '#090A0E',

  borderSubtle: 'rgba(255, 255, 255, 0.07)',
  borderDefault: 'rgba(255, 255, 255, 0.11)',
  borderStrong: 'rgba(255, 255, 255, 0.20)',
} as const;

export const nexaStatus = {
  success: '#42D392',
  warning: '#F6C453',
  error: '#FF647C',
  info: nexaBrand.cyan,
} as const;

export const nexaGradients = {
  opportunity: [nexaBrand.violet, nexaBrand.cyan] as const,
} as const;
