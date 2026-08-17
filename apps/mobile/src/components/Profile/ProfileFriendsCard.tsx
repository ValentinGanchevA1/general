import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, radius } from '@/theme';

interface Props {
  onPress: () => void;
}

export function ProfileFriendsCard({ onPress }: Props): React.JSX.Element {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Friends list"
    >
      <Icon name="account-group" size={22} color={colors.primary} />
      <View style={styles.body}>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.subtitle}>Close friends · following · requests</Text>
      </View>
      <Icon name="chevron-right" size={22} color={colors.textFaint} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    gap: 12,
  },
  body: { flex: 1 },
  title: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
