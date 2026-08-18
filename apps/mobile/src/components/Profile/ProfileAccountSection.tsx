import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, radius } from '@/theme';

interface Props {
  email: string;
  phone: string | null | undefined;
  emailVerified: boolean;
  phoneVerified: boolean;
  onAddPhone: () => void;
}

export function ProfileAccountSection({
  email,
  phone,
  emailVerified,
  phoneVerified,
  onAddPhone,
}: Props): React.JSX.Element {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Account</Text>
      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          <Icon name="email-outline" size={20} color={colors.textMuted} />
          <Text style={styles.infoText}>{email}</Text>
          <Icon
            name={emailVerified ? 'check-circle' : 'circle-outline'}
            size={18}
            color={emailVerified ? colors.success : colors.borderStrong}
          />
        </View>
        <View style={[styles.infoRow, styles.infoRowLast]}>
          <Icon name="phone-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.infoText, !phone && styles.infoTextMuted]}>
            {phone ?? 'No phone added'}
          </Text>
          {phone ? (
            <>
              <Icon
                name={phoneVerified ? 'check-circle' : 'circle-outline'}
                size={18}
                color={phoneVerified ? colors.success : colors.borderStrong}
              />
              <TouchableOpacity onPress={onAddPhone}>
                <Text style={styles.sectionAction}>
                  {phoneVerified ? 'Change' : 'Verify'}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity onPress={onAddPhone}>
              <Text style={styles.sectionAction}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.xl },
  sectionTitle: { color: colors.textPrimary, fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  sectionAction: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  infoCard: {
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
    gap: 10,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoText: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  infoTextMuted: { color: colors.textMuted },
});
