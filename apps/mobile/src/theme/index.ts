// apps/mobile/src/theme/index.ts
//
// NEXA semantic light/dark design system.
// Ownership: sole mobile UI token source of truth.
// packages/shared carries DTOs/socket contracts only — no brand palette.
// Admin (Vite) keeps its own shadcn tokens.
//
// Intentional remaining hex outside this tree:
//   - mapStyle.ts (Google Maps JSON style array)
//   - socialConfig.ts (third-party brand colours)
//   - native platform resources that cannot import TypeScript tokens
// Prefer tokens for all React Native UI. No new feature-owned brand hex.
//
// Migration:
//   - New / refactored UI → useAppTheme().colors semantic tokens
//   - Brand components → nexaBrand / nexaDark / nexaGradients
//   - Existing StyleSheets → static `colors` (dark) until screen is touched

export { nexaBrand, nexaDark, nexaStatus, nexaGradients } from './brand';
export { darkColors, lightColors, protosNexusColors, type ThemeColors } from './colors';
export {
  spacing,
  radius,
  fontSize,
  layout,
  type Spacing,
  type Radius,
  type FontSize,
  type Layout,
} from './tokens';
export {
  ThemeProvider,
  useAppTheme,
  useSystemSchemeListener,
  type Theme,
  type ThemeMode,
  type ResolvedScheme,
  type ProtosNexusEntitlement,
} from './ThemeProvider';

import { darkColors } from './colors';
import { fontSize, layout, radius, spacing } from './tokens';

/**
 * @deprecated Prefer useAppTheme().colors for theme-aware UI.
 * Static dark palette kept for backward compatibility during incremental migration.
 */
export const colors = darkColors;

/** @deprecated Prefer useAppTheme().shadow() */
export const shadow = {
  fab: {
    shadowColor: darkColors.actionPrimary,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
} as const;

/** Static dark theme object (legacy). */
export const theme = {
  colors: darkColors,
  spacing,
  radius,
  fontSize,
  layout,
  shadow,
} as const;
