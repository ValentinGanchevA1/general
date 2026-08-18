import { StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';

/** Shared Gorhom sheet chrome. */
export const sheetChrome = StyleSheet.create({
  background: {
    backgroundColor: colors.surfaceRaised,
  },
  handle: {
    backgroundColor: colors.textMuted,
    width: 40,
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
