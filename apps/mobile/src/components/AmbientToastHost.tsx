// apps/mobile/src/components/AmbientToastHost.tsx
//
// Global toast host for ambient realtime + local celebration events:
//   • level:up              (server)
//   • challenge:completed   (server)
//   • achievement:unlocked  (server)
//   • leaderboard:rank_up   (server reserved + client-synthesized)
//   • wave:received / gift:received
//
// Mounted once in the authenticated area (AppNavigator). Queues concurrent
// events, animates a top toast + haptic, deep-links on tap. Non-blocking —
// never use Alert.alert for these signals on the map.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  type AppStateStatus,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

import type {
  AchievementUnlockedEvent,
  ChallengeCompletedEvent,
  GiftReceivedEvent,
  LeaderboardPage,
  LeaderboardRankUpEvent,
  LeaderboardScope,
  LevelUpEvent,
  WaveReceivedEvent,
} from '@g88/shared';

import { getJson } from '@/api/client';
import { openViaRef } from '@/navigation/openRootScreen';
import { useSocket } from '@/realtime/useSocket';
import { colors } from '@/theme';

const DEFAULT_VISIBLE_MS = 4_200;
const LEVEL_VISIBLE_MS = 5_500;

type ToastItem =
  | { kind: 'level'; data: LevelUpEvent }
  | { kind: 'challenge'; data: ChallengeCompletedEvent }
  | { kind: 'achievement'; data: AchievementUnlockedEvent }
  | { kind: 'rank'; data: LeaderboardRankUpEvent }
  | { kind: 'wave'; data: WaveReceivedEvent }
  | { kind: 'gift'; data: GiftReceivedEvent };

function eyebrowFor(item: ToastItem): string {
  switch (item.kind) {
    case 'level':
      return 'Level up!';
    case 'challenge':
      return 'Challenge complete!';
    case 'achievement':
      return 'Achievement unlocked!';
    case 'rank':
      return item.data.scope === 'weekly' ? 'Weekly climb!' : 'All-time climb!';
    case 'wave':
      return 'New wave';
    case 'gift':
      return 'Gift received';
  }
}

function titleFor(item: ToastItem): string {
  switch (item.kind) {
    case 'level':
      return `Level ${item.data.level}`;
    case 'challenge': {
      const xp = item.data.rewardXp > 0 ? ` · +${item.data.rewardXp} XP` : '';
      return `${item.data.title}${xp}`;
    }
    case 'achievement': {
      const xp =
        item.data.rewardXp > 0 ? ` · +${item.data.rewardXp} XP` : '';
      return `${item.data.title}${xp}`;
    }
    case 'rank':
      return `#${item.data.previousRank} → #${item.data.rank}`;
    case 'wave':
      return `${item.data.fromUser.displayName} waved at you`;
    case 'gift': {
      const msg = item.data.message ? ` — “${item.data.message}”` : '';
      return `${item.data.sender.displayName} sent ${item.data.label}${msg}`;
    }
  }
}

function iconFor(item: ToastItem): string {
  switch (item.kind) {
    case 'level':
      return '⭐';
    case 'challenge':
      return item.data.icon || '✅';
    case 'achievement':
      return item.data.icon || '🏆';
    case 'rank':
      return '📈';
    case 'wave':
      return '👋';
    case 'gift':
      return item.data.emoji || '🎁';
  }
}

function accentFor(item: ToastItem): string {
  switch (item.kind) {
    case 'level':
      return colors.warning;
    case 'challenge':
      return colors.action;
    case 'rank':
      return colors.info;
    default:
      return colors.primary;
  }
}

function visibleMsFor(item: ToastItem): number {
  return item.kind === 'level' ? LEVEL_VISIBLE_MS : DEFAULT_VISIBLE_MS;
}

function hapticFor(item: ToastItem): number[] {
  switch (item.kind) {
    case 'level':
      return [0, 40, 40, 40, 40, 80];
    case 'challenge':
      return [0, 30, 50, 30];
    case 'rank':
      return [0, 25, 40, 25];
    default:
      return [0, 30, 60, 30];
  }
}

const lastRankByScope: Partial<Record<LeaderboardScope, number>> = {};
let rankBaselineReady = false;

export function AmbientToastHost(): React.JSX.Element | null {
  const { on } = useSocket();
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const queueRef = useRef<ToastItem[]>([]);
  const showingRef = useRef(false);
  const [anim] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presentNext = useCallback(() => {
    const next = queueRef.current.shift();
    showingRef.current = next != null;
    setCurrent(next ?? null);
  }, []);

  const dismiss = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    Animated.timing(anim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => presentNext());
  }, [anim, presentNext]);

  const enqueue = useCallback(
    (item: ToastItem) => {
      queueRef.current.push(item);
      if (!showingRef.current) presentNext();
    },
    [presentNext],
  );

  useEffect(() => {
    if (!current) return;
    try {
      Vibration.vibrate(hapticFor(current));
    } catch {
      /* no-op */
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: current.kind === 'level' ? 320 : 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    hideTimer.current = setTimeout(dismiss, visibleMsFor(current));
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [current, anim, dismiss]);

  useEffect(() => {
    const unsubs = [
      on('level:up', (e) => enqueue({ kind: 'level', data: e })),
      on('challenge:completed', (e) => enqueue({ kind: 'challenge', data: e })),
      on('achievement:unlocked', (e) => enqueue({ kind: 'achievement', data: e })),
      on('leaderboard:rank_up', (e) => enqueue({ kind: 'rank', data: e })),
      on('wave:received', (e) => enqueue({ kind: 'wave', data: e })),
      on('gift:received', (e) => enqueue({ kind: 'gift', data: e })),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [on, enqueue]);

  const checkRanks = useCallback(async () => {
    const scopes: LeaderboardScope[] = ['weekly', 'all_time'];
    for (const scope of scopes) {
      try {
        const page = await getJson<LeaderboardPage>(
          `/gamification/leaderboard?scope=${scope}`,
        );
        const rank = page.me?.rank;
        if (rank == null || rank <= 0) continue;
        const prev = lastRankByScope[scope];
        if (rankBaselineReady && prev != null && rank < prev) {
          enqueue({
            kind: 'rank',
            data: {
              scope,
              previousRank: prev,
              rank,
              xp: page.me?.xp ?? 0,
            },
          });
        }
        lastRankByScope[scope] = rank;
      } catch {
        // keep last known
      }
    }
    rankBaselineReady = true;
  }, [enqueue]);

  useEffect(() => {
    void checkRanks();
    const onApp = (state: AppStateStatus) => {
      if (state === 'active') void checkRanks();
    };
    const sub = AppState.addEventListener('change', onApp);
    const unsubs = [
      on('level:up', () => {
        void checkRanks();
      }),
      on('challenge:completed', () => {
        void checkRanks();
      }),
      on('achievement:unlocked', () => {
        void checkRanks();
      }),
    ];
    return () => {
      sub.remove();
      for (const u of unsubs) u();
    };
  }, [checkRanks, on]);

  const onPress = useCallback(() => {
    if (!current) return;
    const item = current;
    dismiss();
    switch (item.kind) {
      case 'level':
        openViaRef('Leaderboard');
        break;
      case 'challenge':
        openViaRef('Challenges');
        break;
      case 'achievement':
        openViaRef('Achievements');
        break;
      case 'rank':
        openViaRef('Leaderboard');
        break;
      case 'wave':
        openViaRef('UserProfile', { userId: item.data.fromUser.id });
        break;
      case 'gift':
        openViaRef('GiftsInbox');
        break;
    }
  }, [current, dismiss]);

  if (!current) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });
  const accent = accentFor(current);
  const isLevel = current.kind === 'level';

  return (
    <Animated.View
      style={[styles.wrap, { opacity: anim, transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={[
          styles.toast,
          {
            borderColor: accent + (isLevel ? '99' : '55'),
            shadowColor: accent,
          },
          isLevel && styles.toastLevel,
        ]}
      >
        <Text style={[styles.icon, isLevel && styles.iconLevel]}>{iconFor(current)}</Text>
        <View style={styles.body}>
          <Text style={[styles.eyebrow, { color: accent }]}>{eyebrowFor(current)}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {titleFor(current)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** @deprecated Use AmbientToastHost — kept as alias for any lingering imports. */
export const AchievementToastHost = AmbientToastHost;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary + '55',
    shadowColor: colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  toastLevel: {
    paddingVertical: 14,
    borderWidth: 1.5,
    shadowOpacity: 0.45,
    shadowRadius: 16,
  },
  icon: { fontSize: 28 },
  iconLevel: { fontSize: 32 },
  body: { flex: 1 },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 },
});
