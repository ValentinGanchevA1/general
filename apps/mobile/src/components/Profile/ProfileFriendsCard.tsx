import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, radius } from '@/theme';

interface Props {
  onPress: () => void;
  /** Pending incoming friend-request count. */
  pendingCount?: number;
}

export function ProfileFriendsCard({ onPress, pendingCount = 0 }: Props): React.JSX.Element {
  const showBadge = pendingCount > 0;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        showBadge ? `Friends list, ${pendingCount} pending requests` : 'Friends list'
      }
    >
      <Icon name="account-group" size={22} color={colors.primary} />
      <View style={styles.body}>
        <Text style={styles.title}>Friends</Text>
        <Text style={styles.subtitle}>Close friends · following · requests</Text>
      </View>
      {showBadge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{pendingCount > 99 ? '99+' : String(pendingCount)}</Text>
        </View>
      ) : null}
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
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: { color: colors.onPrimary, fontSize: 11, fontWeight: '800' },
});
