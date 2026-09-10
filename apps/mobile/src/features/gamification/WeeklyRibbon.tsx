// apps/mobile/src/features/gamification/WeeklyRibbon.tsx
//
// Compact "this week" standing strip under the daily challenge card.
// Shows rank (when the user is ranked, matches the SUM window) and ticks the countdown each minute.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { LeaderboardEntry } from '@g88/shared';
import { colors } from '@/theme';

const MINUTE_MS = 60_000;

/** "2d 6h" / "6h 12m" / "12m" / "resetting…" — coarse, countdown-friendly. */
function formatRemaining(ms: number): string {
  if (ms <= 0) return 'resetting…';
  const totalMin = Math.floor(ms / MINUTE_MS);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

interface WeeklyRibbonProps {
  resetsAt: string;
  me: LeaderboardEntry | null;
}

export function WeeklyRibbon({ resetsAt, me }: WeeklyRibbonProps): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), MINUTE_MS);
    return () => clearInterval(t);
  }, []);

  const remaining = new Date(resetsAt).getTime() - now;
  const isLeader = me?.rank === 1;

  const title = isLeader
    ? "You're #1 this week"
    : me
      ? `You're #${me.rank} this week`
      : "This week's race";

  const standing = me ? `${me.xp.toLocaleString()} XP · ` : '';

  return (
    <View style={[styles.ribbon, isLeader && styles.ribbonLeader]}>
      <Icon
        name={isLeader ? 'crown' : 'flag-checkered'}
        size={18}
        color={isLeader ? colors.premium : colors.primary}
      />
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.sub}>
          {standing}resets in {formatRemaining(remaining)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: 'rgba(0, 212, 255, 0.33)',
  },
  ribbonLeader: { backgroundColor: colors.premiumSoft, borderColor: colors.premiumBorderMid },
  body: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  sub: { color: colors.info, fontSize: 12, marginTop: 2 },
});
