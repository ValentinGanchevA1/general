import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { ChallengeToday, GamificationSummary } from '@g88/shared';
import { colors, spacing, radius, fontSize } from '@/theme';
import { ProfileProgressCard } from './ProfileProgressCard';
import { ProfileChallengesCard } from './ProfileChallengesCard';

interface Props {
  gamification: GamificationSummary | null;
  challenges: ChallengeToday[];
  spendableXp: number;
  onChallenges: () => void;
  onLeaderboard: () => void;
  onAchievements: () => void;
  onGifts: () => void;
  /** Browse marketplace (IA-2). Always available. */
  onMarketplace: () => void;
}

export function ProfileActivityLinks({
  gamification,
  challenges,
  spendableXp,
  onChallenges,
  onLeaderboard,
  onAchievements,
  onGifts,
  onMarketplace,
}: Props): React.JSX.Element | null {
  // Progressive disclosure: hide gamification chrome until the user has real signal.
  const challengeStarted = challenges.some((c) => (c.progress ?? 0) > 0);
  const hasXp = (gamification?.totalXp ?? 0) > 0;
  const leveledUp = (gamification?.level ?? 1) > 1;
  const showGamificationRow = leveledUp || challengeStarted || hasXp;
  const showProgress = gamification != null && (showGamificationRow || challenges.length > 0);
  // Gifts inbox is useful once wallet/activity exists; hide pure-empty new accounts.
  const showGifts = spendableXp > 0 || showGamificationRow;

  // Marketplace is a permanent commerce entry (IA-2) — never fully empty.
  const showMarketplace = true;
  if (!showProgress && !showGamificationRow && !showGifts && !showMarketplace) {
    return null;
  }

  return (
    <>
      {showProgress && gamification ? (
        <View style={styles.sectionPadded}>
          <Text style={styles.blockLabel}>Activity</Text>
          <ProfileProgressCard summary={gamification} />
          {challenges.length > 0 ? <ProfileChallengesCard challenges={challenges} /> : null}
        </View>
      ) : null}

      {showGamificationRow ? (
        <View style={styles.gamificationRow}>
          <TouchableOpacity style={styles.gamificationCard} onPress={onChallenges}>
            <Icon name="checkbox-marked-circle-outline" size={24} color={colors.primary} />
            <Text style={styles.gamificationTitle}>Challenges</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gamificationCard} onPress={onLeaderboard}>
            <Icon name="podium-gold" size={24} color={colors.warning} />
            <Text style={styles.gamificationTitle}>Ranks</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.gamificationCard} onPress={onAchievements}>
            <Icon name="trophy" size={24} color={colors.accent} />
            <Text style={styles.gamificationTitle}>Badges</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {showGifts ? (
        <TouchableOpacity style={styles.giftsCard} onPress={onGifts}>
          <Icon name="gift" size={22} color={colors.accent} />
          <View style={styles.giftsCardBody}>
            <Text style={styles.giftsCardTitle}>Gifts</Text>
            <Text style={styles.giftsCardSubtitle}>{spendableXp.toLocaleString()} XP · inbox</Text>
          </View>
          <Icon name="chevron-right" size={22} color={colors.textFaint} />
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        style={styles.giftsCard}
        onPress={onMarketplace}
        accessibilityRole="button"
        accessibilityLabel="Marketplace"
      >
        <Icon name="storefront-outline" size={22} color={colors.primary} />
        <View style={styles.giftsCardBody}>
          <Text style={styles.giftsCardTitle}>Marketplace</Text>
          <Text style={styles.giftsCardSubtitle}>Nearby listings</Text>
        </View>
        <Icon name="chevron-right" size={22} color={colors.textFaint} />
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  sectionPadded: { paddingHorizontal: spacing.xl, marginTop: spacing.lg },
  blockLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  gamificationRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.xl,
    marginTop: spacing.md,
  },
  gamificationCard: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  gamificationTitle: { color: colors.textPrimary, fontSize: 12, fontWeight: '600' },
  giftsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    gap: 12,
  },
  giftsCardBody: { flex: 1 },
  giftsCardTitle: { color: colors.textPrimary, fontWeight: '700', fontSize: 15 },
  giftsCardSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
