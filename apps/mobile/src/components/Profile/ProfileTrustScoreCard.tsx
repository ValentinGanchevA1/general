import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { fontSize, radius, spacing, useAppTheme } from '@/theme';

export type ProfileTrustScoreCardProps = {
  /** @deprecated Retained for compatibility; NEXA does not render a public numeric trust score. */
  score: number | null | undefined;
  idVerified: boolean;
  onPress?: () => void;
};

/**
 * Compatibility-named component for the self profile identity summary.
 * Numeric trust is intentionally not rendered.
 */
export function ProfileTrustScoreCard({
  idVerified,
  onPress,
}: ProfileTrustScoreCardProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const tone = idVerified ? colors.verified : colors.actionPrimary;

  const body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfacePrimary,
          borderColor: idVerified ? colors.discoveryBorder : colors.borderDefault,
        },
      ]}
    >
      <View
        style={[
          styles.mark,
          {
            backgroundColor: idVerified ? colors.discoverySoft : colors.actionSoft,
            borderColor: idVerified ? colors.discoveryBorder : colors.actionBorderSoft,
          },
        ]}
      >
        <Icon
          name={idVerified ? 'shield-check' : 'shield-outline'}
          size={24}
          color={tone}
        />
      </View>
      <View style={styles.body}>
        <Text style={[styles.eyebrow, { color: colors.textTertiary }]}>IDENTITY</Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {idVerified ? 'Identity verified' : 'Build your identity'}
        </Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {idVerified
            ? 'Government ID verification is complete.'
            : 'Verify your contact details and government ID.'}
        </Text>
      </View>
      {onPress != null ? (
        <Icon name="chevron-right" size={20} color={colors.textTertiary} />
      ) : null}
    </View>
  );

  if (onPress == null) return body;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Open Trust and verification"
      style={({ pressed }) => [pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  pressed: { opacity: 0.82 },
  mark: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginTop: 2,
  },
  hint: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginTop: 2,
  },
});
