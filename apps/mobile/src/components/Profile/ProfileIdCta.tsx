import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { UserProfile } from '@g88/shared';
import { colors, spacing, radius } from '@/theme';

export function ProfileIdCta({
  status,
  onPress,
}: {
  status: UserProfile['idVerificationStatus'];
  onPress: () => void;
}): React.JSX.Element {
  return (
    <View style={styles.sectionPadded}>
      <TouchableOpacity style={styles.idCta} onPress={onPress} activeOpacity={0.85}>
        <View style={styles.idCtaLeft}>
          <Icon name="card-account-details" size={20} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={styles.idCtaTitle}>
              {status === 'pending'
                ? 'ID under review'
                : status === 'rejected'
                  ? 'ID rejected — resubmit'
                  : 'Verify your ID'}
            </Text>
            <Text style={styles.idCtaSub}>
              {status === 'pending'
                ? "We'll notify you when it's done"
                : 'Boost trust and unlock more reach'}
            </Text>
          </View>
        </View>
        <Icon name="chevron-right" size={22} color={colors.textFaint} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
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
  idCtaTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  idCtaSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
