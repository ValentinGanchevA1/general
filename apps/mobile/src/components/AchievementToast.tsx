// apps/mobile/src/components/AchievementToast.tsx
//
// Global toast host for ambient realtime events:
//   • achievement:unlocked
//   • wave:received
//   • gift:received
// Mounted once in the authenticated area (AppNavigator). Queues concurrent
// events, animates a top toast + haptic, deep-links on tap. Non-blocking —
// never use Alert.alert for these signals on the map.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

import type {
  AchievementUnlockedEvent,
  GiftReceivedEvent,
  WaveReceivedEvent,
} from '@g88/shared';

import { navigationRef } from '@/navigation/navigationRef';
import { useSocket } from '@/realtime/useSocket';
import { colors } from '@/theme';

const VISIBLE_MS = 4_200;

type ToastItem =
  | { kind: 'achievement'; data: AchievementUnlockedEvent }
  | { kind: 'wave'; data: WaveReceivedEvent }
  | { kind: 'gift'; data: GiftReceivedEvent };

function eyebrowFor(item: ToastItem): string {
  switch (item.kind) {
    case 'achievement':
      return 'Achievement unlocked!';
    case 'wave':
      return 'New wave';
    case 'gift':
      return 'Gift received';
  }
}

function titleFor(item: ToastItem): string {
  switch (item.kind) {
    case 'achievement': {
      const xp =
        item.data.rewardXp > 0 ? ` · +${item.data.rewardXp} XP` : '';
      return `${item.data.title}${xp}`;
    }
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
    case 'achievement':
      return item.data.icon || '🏆';
    case 'wave':
      return '👋';
    case 'gift':
      return item.data.emoji || '🎁';
  }
}

export function AchievementToastHost(): React.JSX.Element | null {
  const { on } = useSocket();
  const [current, setCurrent] = useState<ToastItem | null>(null);
  const queueRef = useRef<ToastItem[]>([]);
  const showingRef = useRef(false);
  // useState so identity is stable without render-time ref read (react-hooks/refs).
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
      Vibration.vibrate([0, 30, 60, 30]);
    } catch {
      /* no-op on web/sim */
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    hideTimer.current = setTimeout(dismiss, VISIBLE_MS);
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [current, anim, dismiss]);

  useEffect(() => {
    const unsubs = [
      on('achievement:unlocked', (e) => enqueue({ kind: 'achievement', data: e })),
      on('wave:received', (e) => enqueue({ kind: 'wave', data: e })),
      on('gift:received', (e) => enqueue({ kind: 'gift', data: e })),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [on, enqueue]);

  const onPress = useCallback(() => {
    if (!current) return;
    const item = current;
    dismiss();
    if (!navigationRef.isReady()) return;
    switch (item.kind) {
      case 'achievement':
        navigationRef.navigate('Achievements');
        break;
      case 'wave':
        navigationRef.navigate('UserProfile', { userId: item.data.fromUser.id });
        break;
      case 'gift':
        navigationRef.navigate('GiftsInbox');
        break;
    }
  }, [current, dismiss]);

  if (!current) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });

  return (
    <Animated.View
      style={[styles.wrap, { opacity: anim, transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity activeOpacity={0.9} style={styles.toast} onPress={onPress}>
        <Text style={styles.icon}>{iconFor(current)}</Text>
        <View style={styles.body}>
          <Text style={styles.eyebrow}>{eyebrowFor(current)}</Text>
          <Text style={styles.title} numberOfLines={2}>
            {titleFor(current)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

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
  icon: { fontSize: 28 },
  body: { flex: 1 },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: { color: colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 2 },
});
