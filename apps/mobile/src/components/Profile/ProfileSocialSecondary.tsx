import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import type { RelationshipState } from '@g88/shared';
import { colors, spacing } from '@/theme';

export type ProfileSocialSecondaryProps = {
  blocked: boolean;
  isFollowing: boolean;
  friendState: RelationshipState | undefined;
  friendLabel: string;
  followBusy?: boolean;
  friendBusy?: boolean;
  onFollowToggle: () => void;
  onFriendAction: () => void;
};

/**
 * Follow · Friend row under primary CTA (other profile only).
 * Hidden when blocked.
 */
export function ProfileSocialSecondary({
  blocked,
  isFollowing,
  friendState,
  friendLabel,
  followBusy = false,
  friendBusy = false,
  onFollowToggle,
  onFriendAction,
}: ProfileSocialSecondaryProps): React.JSX.Element | null {
  if (blocked) return null;

  const isFriends = friendState === 'friends';
  const friendPending =
    friendState === 'request_outgoing' || friendState === 'request_incoming';

  return (
    <View style={styles.socialSecondary}>
      <TouchableOpacity
        onPress={onFollowToggle}
        disabled={followBusy || friendBusy}
        hitSlop={8}
        accessibilityRole="button"
      >
        {followBusy ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[styles.socialLink, isFollowing && styles.socialLinkActive]}>
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        )}
      </TouchableOpacity>
      <Text style={styles.socialDot}>·</Text>
      {isFriends ? (
        <Text style={styles.socialLinkMuted}>Friends</Text>
      ) : (
        <TouchableOpacity
          onPress={onFriendAction}
          disabled={friendBusy || followBusy}
          hitSlop={8}
          accessibilityRole="button"
        >
          {friendBusy ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={[styles.socialLink, friendPending && styles.socialLinkActive]}>
              {friendLabel}
            </Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  socialSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: spacing.xl,
    marginBottom: 16,
    minHeight: 28,
  },
  socialLink: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  socialLinkActive: { color: colors.textSecondary },
  socialLinkMuted: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
  socialDot: { color: colors.textFaint, fontSize: 14 },
});
