import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { UserProfile } from '@g88/shared';
import { resolveNexaVerifyActionLabel } from '@/product/nexaActionLanguage';
import { spacing, radius, useAppTheme, type ThemeColors } from '@/theme';

export function ProfileIdCta({
  status,
  onPress,
}: {
  status: UserProfile['idVerificationStatus'];
  onPress: () => void;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const actionLabel = resolveNexaVerifyActionLabel(
    'id',
    status === 'rejected' ? 'retry' : 'start',
  );
  const title = status === 'pending' ? 'Identity under review' : actionLabel;
  const detail =
    status === 'pending'
      ? "We'll notify you when the review is complete"
      : status === 'rejected'
        ? 'Try again with clearer photos'
        : 'Complete government ID verification';

  return (
    <View style={styles.sectionPadded}>
      <TouchableOpacity
        style={styles.idCta}
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        <View style={styles.idCtaLeft}>
          <Icon name="card-account-details" size={20} color={colors.warning} />
          <View style={styles.copy}>
            <Text style={styles.idCtaTitle}>{title}</Text>
            <Text style={styles.idCtaSub}>{detail}</Text>
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={colors.textFaint} />
      </TouchableOpacity>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    sectionPadded: { paddingHorizontal: spacing.xl, marginTop: spacing.md },
    idCta: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surfaceRaised,
      borderRadius: radius.md,
      padding: spacing.md,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    idCtaLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
    copy: { flex: 1 },
    idCtaTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
    idCtaSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  });
}
