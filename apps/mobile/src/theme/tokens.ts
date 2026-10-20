// Non-color design tokens (shared across light/dark).

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
  xl: 20,
  /** Card / sheet standard. */
  card: 14,
  pill: 24,
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

/** Touch / layout constants used by primitives. */
export const layout = {
  screenPaddingH: 16,
  buttonHeight: 50,
  minTouch: 44,
  listRowMinHeight: 64,
  cardRadius: 14,
} as const;

export type Spacing = typeof spacing;
export type Radius = typeof radius;
export type FontSize = typeof fontSize;
export type Layout = typeof layout;
