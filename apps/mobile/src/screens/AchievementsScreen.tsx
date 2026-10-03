import React from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { Achievement } from '@g88/shared';
import { useAchievements } from '@/features/gamification/useAchievements';
import { ScreenHeader } from '@/components/ScreenHeader';
import { EmptyState } from '@/components/EmptyState';
import { SoftErrorBanner } from '@/components/SoftErrorBanner';
import { SkeletonListRow } from '@/components/Skeleton';
import { colors } from '@/theme';

function AchievementRow({ a }: { a: Achievement }): React.JSX.Element {
  return (
    <View style={[styles.row, a.unlocked && styles.rowDone]}>
      <View style={[styles.iconWrap, a.unlocked && styles.iconWrapDone]}>
        <Icon
          name={a.unlocked ? 'trophy' : 'trophy-outline'}
          size={22}
          color={a.unlocked ? colors.bg : colors.premium}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.title}>{a.title}</Text>
        {a.description ? <Text style={styles.body}>{a.description}</Text> : null}
        {a.unlocked ? (
          <Text style={styles.doneText}>Unlocked</Text>
        ) : a.target != null && a.progress != null ? (
          <Text style={styles.progressText}>
            {a.progress}/{a.target}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function AchievementsScreen(): React.JSX.Element {
  const { achievements, loading, error, refresh } = useAchievements();
  const unlockedCount = achievements.filter((a) => a.unlocked).length;
  const showErrorEmpty = error != null && achievements.length === 0 && !loading;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Achievements" />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {error != null && achievements.length > 0 ? (
          <SoftErrorBanner onRetry={refresh} />
        ) : null}
        {achievements.length > 0 ? (
          <Text style={styles.summary}>
            {unlockedCount} of {achievements.length} unlocked
          </Text>
        ) : loading ? (
          <>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </>
        ) : showErrorEmpty ? (
          <EmptyState
            variant="plain"
            icon="alert-circle-outline"
            title="Couldn't load achievements"
            body="Check your connection and try again."
            actionLabel="Retry"
            onAction={refresh}
          />
        ) : null}

        {achievements.map((a) => (
          <AchievementRow key={a.id} a={a} />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
  summary: { color: colors.textMuted, fontSize: 14, textAlign: 'center', marginBottom: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  rowDone: { borderColor: colors.premiumBorderSoft, backgroundColor: colors.premiumSoft },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.premiumMutedBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapDone: { backgroundColor: colors.premium },
  info: { flex: 1, gap: 4 },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  body: { color: colors.textMuted, fontSize: 13 },
  doneText: { color: colors.premium, fontSize: 13, fontWeight: '600', marginTop: 2 },
  progressText: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
});
