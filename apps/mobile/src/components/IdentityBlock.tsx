import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';

import type { VerificationLevel } from '@g88/shared';
import { Avatar, type AvatarRingVariant } from '@/components/Avatar';
import { VerificationBadge } from '@/components/VerificationBadge';
import { colors, spacing } from '@/theme';

export interface IdentityBlockProps {
  name: string;
  avatarUrl?: string | null;
  verification?: VerificationLevel;
  idVerified?: boolean;
  age?: number | null;
  hometownCity?: string | null;
  hometownCountry?: string | null;
  online?: boolean;
  isFriend?: boolean;
  ringVariant?: AvatarRingVariant;
  /** Level number only (e.g. 12). */
  level?: number | null;
  /** All-time rank (e.g. 42). */
  allTimeRank?: number | null;
  /** Up to 3 achievement icon strings. */
  achievementIcons?: string[];
  avatarSize?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * Shared identity header for map EntityBottomSheet and public profile cards.
 * Order: Avatar → name + verification → origin → presence → compact stats.
 */
export function IdentityBlock({
  name,
  avatarUrl,
  verification = 'none',
  idVerified = false,
  age,
  hometownCity,
  hometownCountry,
  online = false,
  isFriend = false,
  ringVariant,
  level,
  allTimeRank,
  achievementIcons = [],
  avatarSize = 56,
  onPress,
  style,
}: IdentityBlockProps): React.JSX.Element {
  const origin = [hometownCity, hometownCountry].filter(Boolean).join(', ');
  const icons = achievementIcons.slice(0, 3);
  const hasStats = level != null || allTimeRank != null || icons.length > 0;

  const body = (
    <View style={[styles.row, style]}>
      <Avatar
        uri={avatarUrl}
        name={name}
        size={avatarSize}
        online={online}
        isFriend={isFriend}
        {...(ringVariant != null
          ? { ringVariant }
          : isFriend
            ? { ringVariant: 'friend' as const }
            : { ring: true })}
      />
      <View style={styles.textCol}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <VerificationBadge
            verification={verification}
            idVerified={idVerified}
            size={16}
          />
        </View>
        {age != null ? <Text style={styles.meta}>{age} years</Text> : null}
        {origin ? (
          <Text style={styles.meta} numberOfLines={1}>
            {origin}
          </Text>
        ) : null}
        <Text style={[styles.presence, !online && styles.presenceOff]}>
          {online ? 'Online' : 'Offline'}
        </Text>
        {hasStats ? (
          <View style={styles.statsRow}>
            {level != null ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>Lv {level}</Text>
              </View>
            ) : null}
            {allTimeRank != null ? (
              <View style={styles.pill}>
                <Text style={styles.pillText}>#{allTimeRank}</Text>
              </View>
            ) : null}
            {icons.map((icon, i) => (
              <Text key={`${icon}-${i}`} style={styles.icon}>
                {icon}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.85} accessibilityRole="button">
        {body}
      </TouchableOpacity>
    );
  }
  return body;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  textCol: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', flexShrink: 1 },
  meta: { color: colors.textSecondary, fontSize: 13 },
  presence: { color: colors.success, fontSize: 12, fontWeight: '600', marginTop: 2 },
  presenceOff: { color: colors.textFaint, fontWeight: '500' },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  pill: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  pillText: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
  icon: { fontSize: 14 },
});
