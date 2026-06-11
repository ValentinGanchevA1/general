// apps/mobile/src/components/AchievementToast.tsx
//
// Global, self-contained host for the `achievement:unlocked` realtime event.
// Mounted once in the authenticated area (AppNavigator) so an unlock surfaces
// no matter which screen the user is on. Shows an animated top toast + haptic,
// queues concurrent unlocks, and deep-links to the Achievements screen on tap.

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

import type { AchievementUnlockedEvent } from '@g88/shared';

import { useSocket } from '@/realtime/useSocket';
import { navigationRef } from '@/navigation/navigationRef';

const VISIBLE_MS = 3500;

export function AchievementToastHost(): React.JSX.Element | null {
  const { on } = useSocket();
  const queueRef = useRef<AchievementUnlockedEvent[]>([]);
  const showingRef = useRef(false);
  const [current, setCurrent] = useState<AchievementUnlockedEvent | null>(null);
  // useState (not useRef) so the value is read-safe during render — a ref's
  // .current must not be accessed in render (react-hooks/refs). Identity is
  // stable across renders.
  const [anim] = useState(() => new Animated.Value(0));
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Pull the next queued unlock, or go idle when the queue drains.
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

  // Animate in + haptic + schedule auto-dismiss whenever a new toast mounts.
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

  // Subscribe once; the handler reads queue/showing via refs to stay stable.
  useEffect(() => {
    const unsub = on('achievement:unlocked', (e) => {
      queueRef.current.push(e);
      if (!showingRef.current) presentNext();
    });
    return unsub;
  }, [on, presentNext]);

  const openAchievements = useCallback(() => {
    dismiss();
    if (navigationRef.isReady()) navigationRef.navigate('Achievements');
  }, [dismiss]);

  if (!current) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-140, 0] });

  return (
    <Animated.View
      style={[styles.wrap, { opacity: anim, transform: [{ translateY }] }]}
      pointerEvents="box-none"
    >
      <TouchableOpacity activeOpacity={0.9} style={styles.toast} onPress={openAchievements}>
        <Text style={styles.icon}>{current.icon}</Text>
        <View style={styles.body}>
          <Text style={styles.eyebrow}>Achievement unlocked!</Text>
          <Text style={styles.title} numberOfLines={1}>
            {current.title}
            {current.rewardXp > 0 ? ` · +${current.rewardXp} XP` : ''}
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
    backgroundColor: '#12121f',
    borderWidth: 1,
    borderColor: '#00d4ff55',
    shadowColor: '#00d4ff',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  icon: { fontSize: 28 },
  body: { flex: 1 },
  eyebrow: { color: '#00d4ff', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  title: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 2 },
});
