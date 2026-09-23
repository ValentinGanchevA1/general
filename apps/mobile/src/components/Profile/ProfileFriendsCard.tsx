import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, spacing, radius } from '@/theme';

interface Props {
  onPress: () => void;
  /** Opens Suggestions (people you may know). */
  onPressSuggestions?: () => void;
  /** Pending incoming friend-request count. */
  pendingCount?: number;
}

export function ProfileFriendsCard({
  onPress,
  onPressSuggestions,
  pendingCount = 0,
}: Props): React.JSX.Element {
  const showBadge = pendingCount > 0;
  return (
    <View style={styles.wrap}>
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
            <Text style={styles.badgeText}>
              {pendingCount > 99 ? '99+' : String(pendingCount)}
            </Text>
          </View>
        ) : null}
        <Icon name="chevron-right" size={22} color={colors.textFaint} />
      </TouchableOpacity>
      {onPressSuggestions ? (
        <TouchableOpacity
          style={styles.suggestRow}
          onPress={onPressSuggestions}
          accessibilityRole="button"
          accessibilityLabel="People you may know"
        >
          <Icon name="account-plus-outline" size={18} color={colors.primary} />
          <Text style={styles.suggestText}>People you may know</Text>
          <Icon name="chevron-right" size={18} color={colors.textFaint} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    borderRadius: radius.md,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
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
  suggestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  suggestText: {
    flex: 1,
    color: colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
