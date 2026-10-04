import {StyleSheet} from 'react-native';
import {colors, radius, spacing} from '@/theme';

export const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minWidth: 260,
    maxWidth: 320,
    // elevation
    shadowColor: colors.shadowInk,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: {width: 0, height: 4},
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  dismissBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dismissText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 2,
  },
  primaryBtn: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  waveBtn: {
    backgroundColor: colors.primary,
  },
  likeBtn: {
    backgroundColor: colors.entityUser,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  primaryBtnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  openBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  openBtnText: {
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
});
