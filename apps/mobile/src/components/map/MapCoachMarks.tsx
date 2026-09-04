// First map session after sign-in / profile setup.
// Three steps for the core loop, then permanent dismiss (AsyncStorage).
// Skip always available — never block power users.

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

/** Persist key — do not rename (users who finished v1 stay done). */
const STORAGE_KEY = 'g88:map_coach_v1';

interface Step {
  id: 'pin' | 'wave' | 'pulse';
  emoji: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    id: 'pin',
    emoji: '📍',
    title: 'You are on the map',
    body: 'Your pin is your presence. Other pins are people, events, and listings nearby. Pan and zoom to explore the area.',
  },
  {
    id: 'wave',
    emoji: '👋',
    title: 'Wave to say hi',
    body: 'Tap a person to open their card, then Wave. If they wave back, you can chat — no cold DMs.',
  },
  {
    id: 'pulse',
    emoji: '⚡',
    title: 'Pulse is nearby life',
    body: 'Open the Pulse tab for stories and activity around you. Come back to the map anytime to meet people in place.',
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
  /** null = still loading; true = should show when map ready; false = already done */
  const [shouldShow, setShouldShow] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled) setShouldShow(raw !== 'done');
      } catch {
        if (!cancelled) setShouldShow(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (shouldShow !== true || !mapReady || visible) return;
    // Short delay so markers / chrome paint before the overlay.
    const t = setTimeout(() => {
      setVisible(true);
      track('map.coach_shown', { step: STEPS[0]!.id });
    }, 700);
    return () => clearTimeout(t);
  }, [shouldShow, mapReady, visible]);

  const persistDone = useCallback(
    async (reason: 'completed' | 'skipped') => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, 'done');
      } catch {
        // still hide UI
      }
      track('map.coach_dismissed', {
        reason,
        step: STEPS[step]?.id ?? 'unknown',
      });
      setShouldShow(false);
      setVisible(false);
    },
    [step],
  );

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
      <View style={styles.backdrop} accessibilityViewIsModal>
        <View
          style={[
            styles.card,
            { marginBottom: Math.max(insets.bottom, spacing.lg) + 72 },
          ]}
        >
          <Text style={styles.progress}>
            {step + 1} of {STEPS.length}
          </Text>
          <Text style={styles.emoji}>{current.emoji}</Text>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.body}>{current.body}</Text>

          <View style={styles.dots} accessibilityElementsHidden>
            {STEPS.map((s, i) => (
              <View
                key={s.id}
                style={[styles.dot, i === step && styles.dotActive]}
              />
            ))}
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={onSkip}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Skip introduction"
            >
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
            <Pressable
              style={styles.nextBtn}
              onPress={onNext}
              accessibilityRole="button"
              accessibilityLabel={isLast ? 'Finish introduction' : 'Next step'}
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
  progress: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    fontWeight: '600',
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
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
    minHeight: 44,
    justifyContent: 'center',
  },
  nextLabel: {
    color: colors.onPrimary,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
