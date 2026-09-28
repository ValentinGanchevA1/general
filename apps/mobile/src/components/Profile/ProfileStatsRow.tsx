import React from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { colors, radius } from '@/theme';

export type ProfileStatsRowProps = {
  level: number | null | undefined;
  allTimeRank: number | null | undefined;
  achievementIcons?: string[] | null;
  onLayout?: (e: LayoutChangeEvent) => void;
};

/**
 * Level / rank / achievement icons row (Activity).
 * Returns null when nothing to show.
 */
export function ProfileStatsRow({
  level,
  allTimeRank,
  achievementIcons,
  onLayout,
}: ProfileStatsRowProps): React.JSX.Element | null {
  const icons = achievementIcons?.slice(0, 3) ?? [];
  const has =
    level != null || allTimeRank != null || icons.length > 0;
  if (!has) return null;

  return (
    <View style={styles.statsBlock} onLayout={onLayout}>
      <Text style={styles.sectionLabel}>Activity</Text>
      <View style={styles.statsRow}>
        {level != null ? (
          <View style={styles.statPill}>
            <Text style={styles.statPillValue}>Lv {level}</Text>
          </View>
        ) : null}
        {allTimeRank != null ? (
          <View style={styles.statPill}>
            <Text style={styles.statPillValue}>#{allTimeRank}</Text>
          </View>
        ) : null}
        {icons.length > 0 ? (
          <View style={styles.achievementIcons}>
            {icons.map((icon, i) => (
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

const styles = StyleSheet.create({
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
