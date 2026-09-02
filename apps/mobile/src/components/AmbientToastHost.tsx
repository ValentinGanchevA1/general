// apps/mobile/src/components/AmbientToastHost.tsx
//
// Global toast host for ambient realtime + local celebration events:
//   • level:up              (server)
//   • challenge:completed   (server)
//   • achievement:unlocked  (server)
//   • leaderboard:rank_up   (server reserved + client-synthesized)
//   • wave:received / gift:received
//
// Visual system (two layers):
//   • Background — kind-specific gradient wash (never another plain challenge card)
//   • Main — icon badge or peer avatar
//
// Mounted once in the authenticated area (AppNavigator). Queues concurrent
// events, animates a top toast + haptic, deep-links on tap.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  type AppStateStatus,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
import { colors, radius } from '@/theme';

/** Clears DailyChallengeCard (~56) + gap when card is visible on map. */
const BELOW_CHALLENGE_EXTRA = 64;
const DEFAULT_VISIBLE_MS = 4_000;
const LEVEL_VISIBLE_MS = 5_800;

type ToastItem =
  | { kind: 'level'; data: LevelUpEvent }
  | { kind: 'challenge'; data: ChallengeCompletedEvent }
  | { kind: 'achievement'; data: AchievementUnlockedEvent }
  | { kind: 'rank'; data: LeaderboardRankUpEvent }
  | { kind: 'wave'; data: WaveReceivedEvent }
  | { kind: 'gift'; data: GiftReceivedEvent };

type ToastVisual = {
  eyebrow: string;
  title: string;
  /** XP chip text, e.g. "+50 XP". */
  xpLabel?: string;
  /** Emoji when no avatar. */
  icon: string;
  /** Optional peer avatar (wave / gift) — the "main" face. */
  avatarUrl?: string | null;
  /** Gradient wash (background layer). */
  gradient: [string, string, ...string[]];
  accent: string;
  border: string;
};

function visualFor(item: ToastItem): ToastVisual {
  switch (item.kind) {
    case 'level':
      return {
        eyebrow: 'Level up',
        title: `You reached level ${item.data.level}`,
        icon: '⭐',
        gradient: ['#2a1a08', '#12121f', '#0a0a0f'],
        accent: colors.warning,
        border: colors.warning + '99',
      };
    case 'challenge': {
      const xp =
        item.data.rewardXp > 0 ? `+${item.data.rewardXp} XP` : undefined;
      return {
        eyebrow: 'Challenge complete',
        title: item.data.title,
        ...(xp ? { xpLabel: xp } : {}),
        icon: item.data.icon || '✅',
        gradient: ['#0d2818', '#12121f', '#0a0a0f'],
        accent: colors.action,
        border: colors.action + '88',
      };
    }
    case 'achievement': {
      const xp =
        item.data.rewardXp > 0 ? `+${item.data.rewardXp} XP` : undefined;
      return {
        eyebrow: 'Achievement unlocked',
        title: item.data.title,
        ...(xp ? { xpLabel: xp } : {}),
        icon: item.data.icon || '🏆',
        gradient: ['#1a1030', '#12121f', '#0a0a0f'],
        accent: colors.accent,
        border: colors.accent + '88',
      };
    }
    case 'rank':
      return {
        eyebrow:
          item.data.scope === 'weekly' ? 'Weekly climb' : 'All-time climb',
        title: `#${item.data.previousRank} → #${item.data.rank}`,
        icon: '📈',
        gradient: ['#0a2030', '#12121f', '#0a0a0f'],
        accent: colors.info,
        border: colors.info + '88',
      };
    case 'wave':
      return {
        eyebrow: 'New wave',
        title: `${item.data.fromUser.displayName} waved at you`,
        icon: '👋',
        avatarUrl: item.data.fromUser.avatarUrl,
        gradient: ['#0a2430', '#12121f', '#0a0a0f'],
        accent: colors.primary,
        border: colors.primary + '66',
      };
    case 'gift': {
      const msg = item.data.message ? ` — “${item.data.message}”` : '';
      return {
        eyebrow: 'Gift received',
        title: `${item.data.sender.displayName} sent ${item.data.label}${msg}`,
        icon: item.data.emoji || '🎁',
        avatarUrl: item.data.sender.avatarUrl,
        gradient: ['#2a1030', '#12121f', '#0a0a0f'],
        accent: colors.accent,
        border: colors.accent + '66',
      };
    }
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
  const insets = useSafeAreaInsets();
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const queueRef = useRef<ToastItem[]>([]);
  const showingRef = useRef(false);
  const [anim] = useState(() => new Animated.Value(0));
  const [scale] = useState(() => new Animated.Value(0.92));
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
    Animated.parallel([
      Animated.timing(anim, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 0.92,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => presentNext());
  }, [anim, scale, presentNext]);

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
    anim.setValue(0);
    scale.setValue(current.kind === 'level' ? 0.86 : 0.94);
    Animated.parallel([
      Animated.timing(anim, {
        toValue: 1,
        duration: current.kind === 'level' ? 340 : 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 7,
        tension: 120,
        useNativeDriver: true,
      }),
    ]).start();
    hideTimer.current = setTimeout(dismiss, visibleMsFor(current));
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [current, anim, scale, dismiss]);

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

  const v = visualFor(current);
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-28, 0],
  });
  // Sit under safe area + daily challenge card so the two don't stack as twins.
  const top = insets.top + 8 + BELOW_CHALLENGE_EXTRA;
  const isCelebration =
    current.kind === 'level' ||
    current.kind === 'challenge' ||
    current.kind === 'achievement';

  return (
    <Animated.View
      style={[
        styles.wrap,
        {
          top,
          opacity: anim,
          transform: [{ translateY }, { scale }],
        },
      ]}
      pointerEvents="box-none"
    >
      <TouchableOpacity activeOpacity={0.92} onPress={onPress} style={styles.touch}>
        <View style={[styles.card, { borderColor: v.border }]}>
          {/* Background layer — kind wash */}
          <LinearGradient
            colors={v.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* Soft accent glow top-left */}
          <View
            style={[styles.glow, { backgroundColor: v.accent + '22' }]}
            pointerEvents="none"
          />

          {/* Main layer — avatar or icon badge */}
          <View style={[styles.badge, { borderColor: v.accent + '66' }]}>
            {v.avatarUrl ? (
              <Image source={{ uri: v.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.iconCircle, { backgroundColor: v.accent + '28' }]}>
                <Text style={styles.iconEmoji}>{v.icon}</Text>
              </View>
            )}
          </View>

          <View style={styles.body}>
            <Text style={[styles.eyebrow, { color: v.accent }]} numberOfLines={1}>
              {v.eyebrow}
            </Text>
            <Text style={styles.title} numberOfLines={2}>
              {v.title}
            </Text>
          </View>

          {v.xpLabel ? (
            <View style={[styles.xpChip, { backgroundColor: v.accent + '22' }]}>
              <Text style={[styles.xpText, { color: v.accent }]}>{v.xpLabel}</Text>
            </View>
          ) : isCelebration && current.kind === 'level' ? (
            <View style={[styles.xpChip, { backgroundColor: v.accent + '22' }]}>
              <Text style={[styles.xpText, { color: v.accent }]}>Lv {current.data.level}</Text>
            </View>
          ) : null}
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
    left: 16,
    right: 16,
    zIndex: 1000,
    alignItems: 'center',
  },
  touch: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    minHeight: 64,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    // Elevation / shadow for separation from map chrome
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  glow: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    top: -40,
    left: -30,
  },
  badge: {
    position: 'relative' as const,
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceRaised,
  },
  avatar: {
    width: 44,
    height: 44,
  },
  iconCircle: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 22,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 3,
    lineHeight: 20,
  },
  xpChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  xpText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
