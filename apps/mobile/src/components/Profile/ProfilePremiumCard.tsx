import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, radius } from '@/theme';

interface Props {
  onPress: () => void;
}

/** Bottom-of-profile Premium upsell — free users only. */
export function ProfilePremiumCard({ onPress }: Props): React.JSX.Element {
  return (
    <TouchableOpacity style={styles.upgradeCard} onPress={onPress} accessibilityRole="button">
      <View style={styles.upgradeContent}>
        <Icon name="crown" size={26} color="#FFD700" />
        <View style={styles.upgradeText}>
          <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
          <Text style={styles.upgradeSubtitle}>More reach · who viewed you</Text>
        </View>
      </View>
      <Icon name="chevron-right" size={22} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FFD70040',
  },
  upgradeContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeText: { flex: 1 },
  upgradeTitle: { color: '#FFD700', fontWeight: '700', fontSize: 15 },
  upgradeSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
