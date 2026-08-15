// First-session map coach — three steps, then permanent dismiss.
// Goal: teach people-nearby → wave → create without blocking power users (Skip).

import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fontSize, radius, spacing } from '@/theme';
import { track } from '@/lib/analytics';

const STORAGE_KEY = 'g88:map_coach_v1';

interface Step {
  id: 'people' | 'wave' | 'create';
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    id: 'people',
    emoji: '📍',
    title: 'People near you',
    body: 'Pins on the map are people, events, and listings nearby. Tap a pin to open their card.',
  },
  {
    id: 'wave',
    emoji: '👋',
    title: 'Wave to say hi',
    body: 'Open a person and send a wave. If they wave back, you can chat — no cold DMs.',
  },
  {
    id: 'create',
    emoji: '＋',
    title: 'Post nearby',
    body: 'Use the button at the bottom to create a listing, alert, or event around you.',
  },
];

interface Props {
  /** True once map has a settled region (avoids flash on cold start). */
  mapReady: boolean;
}

export function MapCoachMarks({ mapReady }: Props): React.JSX.Element | null {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled) return;
        if (raw === 'done') {
          setLoaded(true);
          return;
        }
        setLoaded(true);
      } catch {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Show after map is ready + storage checked, slight delay so markers paint.
  useEffect(() => {
    if (!loaded || !mapReady) return;
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (cancelled || raw === 'done') return;
        const t = setTimeout(() => {
          if (cancelled) return;
          setVisible(true);
          track('map.coach_shown', { step: STEPS[0]!.id });
        }, 600);
        return () => clearTimeout(t);
      } catch {
        // fail closed — don't block map
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loaded, mapReady]);

  const persistDone = useCallback(async (reason: 'completed' | 'skipped') => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'done');
    } catch {
      // still hide UI
    }
    track('map.coach_dismissed', { reason, step: STEPS[step]?.id ?? 'unknown' });
    setVisible(false);
  }, [step]);

  const onNext = useCallback(() => {
    if (step >= STEPS.length - 1) {
      void persistDone('completed');
      return;
    }
    const next = step + 1;
    setStep(next);
    track('map.coach_step', { step: STEPS[next]!.id });
  }, [step, persistDone]);

  const onSkip = useCallback(() => {
    void persistDone('skipped');
  }, [persistDone]);

  if (!visible) return null;

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={[styles.card, { marginBottom: Math.max(insets.bottom, spacing.lg) + 72 }]}>
          <Text style={styles.emoji}>{current.emoji}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          <View style={styles.dots}>
            {STEPS.map((s, i) => (
              <View
                key={s.id}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable onPress={onSkip} hitSlop={8} accessibilityRole="button">
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
            <Pressable
              style={styles.nextBtn}
              onPress={onNext}
              accessibilityRole="button"
            >
              <Text style={styles.nextLabel}>{isLast ? 'Got it' : 'Next'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: spacing.xl,
  },
  emoji: {
    fontSize: 28,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  body: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skip: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    fontWeight: '600',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  nextBtn: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.pill,
  },
  nextLabel: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
