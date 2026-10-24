import React, { useMemo } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { radius, useAppTheme, type ThemeColors } from '@/theme';

export type ProfileStatsRowProps = {
  level?: number | null;
  /** @deprecated Retained for DTO/call-site compatibility; public rank is not rendered. */
  allTimeRank?: number | null;
  achievementIcons?: string[] | null;
  onLayout?: (e: LayoutChangeEvent) => void;
};

export type PublicProfileActivity = {
  level: number | null;
  achievementIcons: string[];
};

/**
 * Visitor-safe activity presentation.
 *
 * Leaderboard rank is intentionally excluded: NEXA may use rank inside explicit
 * leaderboard/gamification surfaces, but public identity/profile surfaces must
 * not turn it into a popularity signal.
 */
export function buildPublicProfileActivity(
  level: number | null | undefined,
  achievementIcons: string[] | null | undefined,
): PublicProfileActivity {
  return {
    level: level ?? null,
    achievementIcons: achievementIcons?.slice(0, 3) ?? [],
  };
}

/** Public activity row: level + earned achievements, never leaderboard rank. */
export function ProfileStatsRow({
  level,
  achievementIcons,
  onLayout,
}: ProfileStatsRowProps): React.JSX.Element | null {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const activity = buildPublicProfileActivity(level, achievementIcons);
  const has = activity.level != null || activity.achievementIcons.length > 0;
  if (!has) return null;

  return (
    <View style={styles.statsBlock} onLayout={onLayout}>
      <Text style={styles.sectionLabel}>Activity</Text>
      <View style={styles.statsRow}>
        {activity.level != null ? (
          <View style={styles.statPill}>
            <Text style={styles.statPillValue}>Lv {activity.level}</Text>
          </View>
        ) : null}
        {activity.achievementIcons.length > 0 ? (
          <View style={styles.achievementIcons}>
            {activity.achievementIcons.map((icon, i) => (
              <Text key={`${icon}-${i}`} style={styles.achievementIcon}>
                {icon}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    statsBlock: { gap: 6 },
    sectionLabel: {
      color: colors.textFaint,
      fontSize: 11,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
    statPill: {
      backgroundColor: colors.surface,
      borderRadius: radius.md,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    statPillValue: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
    achievementIcons: { flexDirection: 'row', gap: 4 },
    achievementIcon: { fontSize: 16 },
  });
}
