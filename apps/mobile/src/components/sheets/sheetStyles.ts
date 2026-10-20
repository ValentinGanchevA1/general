import { StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

/** Shared Gorhom sheet chrome. NEXA sheets use a distinct elevated spatial surface. */
export const sheetChrome = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceRaised,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderSubtle,
    overflow: 'hidden',
  },
  handle: {
    backgroundColor: colors.textTertiary,
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  content: {
    paddingBottom: spacing.xl,
  },
  actionList: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
    gap: 4,
  },
  actionTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
});
