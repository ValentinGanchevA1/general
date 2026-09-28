import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { colors, fontSize, spacing } from '@/theme';

export type ProfileIdentityLineProps = {
  /** Pre-formatted via formatPublicIdentityParts. */
  identityLine: string | null;
  hometownLine: string | null;
  /**
   * self = optional press → edit; other = static display.
   * Default other.
   */
  mode?: 'self' | 'other';
  onPress?: () => void;
  /** Self empty state copy when nothing public yet. */
  emptyHint?: string;
};

/**
 * Hometown + identity chips under the hero name.
 * Presentational only — caller formats lines.
 */
export function ProfileIdentityLine({
  identityLine,
  hometownLine,
  mode = 'other',
  onPress,
  emptyHint = 'Add gender, nationality · Edit',
}: ProfileIdentityLineProps): React.JSX.Element | null {
  const hasContent = Boolean(identityLine || hometownLine);

  if (mode === 'self') {
    return (
      <TouchableOpacity
        style={styles.selfBox}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Edit public identity"
      >
        {hasContent ? (
          <>
            {hometownLine ? <Text style={styles.line}>{hometownLine}</Text> : null}
            {identityLine ? <Text style={styles.line}>{identityLine}</Text> : null}
            <Text style={styles.hint}>Visible on profile · Edit</Text>
          </>
        ) : (
          <>
            <Text style={styles.empty}>No public identity details</Text>
            <Text style={styles.hint}>{emptyHint}</Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  if (!hasContent) return null;

  return (
    <View style={styles.otherWrap}>
      {hometownLine ? <Text style={styles.originLine}>{hometownLine}</Text> : null}
      {identityLine ? <Text style={styles.identityLine}>{identityLine}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  otherWrap: {
    alignItems: 'center',
    gap: 2,
  },
  originLine: { color: colors.textMuted, fontSize: 14 },
  identityLine: { color: colors.textFaint, fontSize: 13 },
  selfBox: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.xl,
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    gap: 2,
  },
  line: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  empty: {
    color: colors.textFaint,
    fontSize: fontSize.sm,
  },
  hint: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
});
