// apps/mobile/src/features/nudges/useNudges.ts
//
// P3.1 leftover "nudges" — the last surfacing item on the gamification epic
// (ROADMAP P3.1: optional "complete your verification" / streak nudges, no
// net-new backend). Derives 0–1 contextual nudges purely from state the app
// already loads (profile badges + gamification streak) and returns the highest
// priority one for a banner to render. Dismissals are persisted with a per-nudge
// cooldown so a dismissed nudge stays gone for a few days instead of nagging.
//
// The streak nudge celebrates *milestone* days (3/7/14/30/…) rather than
// reminding "keep it going today" — the foreground `ping` already secures the
// streak before the Map renders, so a daily reminder would be redundant nagging.
// Eligibility lives in the pure, unit-tested `selectNudge` below.

import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { useGamification } from '@/features/gamification/useGamification';

/** Param-less screens a nudge can deep-link to. */
type NudgeTarget = Extract<
  keyof RootStackParamList,
  'VerificationId' | 'Challenges'
>;

export interface Nudge {
  id: string;
  /** MaterialCommunityIcons name. */
  icon: string;
  /** Accent color for icon + CTA. */
  accent: string;
  /** Small eyebrow label. */
  label: string;
  /** Main one-line message. */
  title: string;
  /** CTA button text. */
  cta: string;
  /** Screen to open on tap. */
  target: NudgeTarget;
  /** Days a dismissal suppresses this nudge before it may reappear. */
  cooldownDays: number;
}

const DISMISS_KEY = 'g88:nudges:dismissed';
const DAY_MS = 24 * 60 * 60 * 1000;
// Hold the verification nudge until the account is ~2 days old (post-D2). New
// users get to explore before we ask them to verify (ROADMAP §P3.4).
const VERIFY_NUDGE_MIN_AGE_MS = 2 * DAY_MS;
// Streak days worth celebrating. The streak is *secured* by the foreground
// `ping` (sets last_active_date = today) before the Map renders, so a
// "keep it going today" reminder is both redundant and a daily nag. Instead we
// celebrate on the day a milestone is reached — and since `currentStreak` only
// equals each value on a single day, each milestone surfaces ~once naturally.
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

/** Celebratory one-liner that scales with the milestone. */
function streakTitle(streak: number): string {
  if (streak >= 100) return `🔥 ${streak}-day streak — legendary!`;
  if (streak >= 30) return `🔥 ${streak}-day streak — incredible!`;
  if (streak >= 7) return `🔥 ${streak}-day streak — you're on fire!`;
  return `🔥 ${streak}-day streak — nice work!`;
}

type DismissMap = Record<string, number>; // nudge id → epoch ms of last dismiss

/** Inputs for {@link selectNudge} — everything it needs, no hooks/clock reads. */
export interface NudgeInputs {
  idVerificationStatus: string | undefined;
  /** ISO account-creation timestamp, for the verification age gate. */
  createdAt: string | undefined;
  currentStreak: number;
  /** nudge id → epoch ms of last dismissal. */
  dismissed: DismissMap;
  /** Captured wall-clock (epoch ms). */
  now: number;
}

/**
 * Pure nudge selection: build the candidate list in priority order (verification
 * outranks the streak celebration) and return the first that applies and isn't
 * on cooldown. Extracted from the hook so the eligibility rules are unit-testable
 * without rendering.
 */
export function selectNudge({
  idVerificationStatus: idStatus,
  createdAt,
  currentStreak,
  dismissed,
  now,
}: NudgeInputs): Nudge | null {
  const candidates: Nudge[] = [];

  // Account age gate: only nudge once the user has had ~2 days to settle in.
  // A rejected ID is time-sensitive, so it bypasses the age hold.
  const oldEnoughToNudge = createdAt
    ? now - Date.parse(createdAt) >= VERIFY_NUDGE_MIN_AGE_MS
    : false;
  if ((idStatus === 'none' && oldEnoughToNudge) || idStatus === 'rejected') {
    candidates.push({
      id: 'verify-id',
      icon: 'shield-alert',
      accent: '#FF9800',
      label: 'Verification',
      title:
        idStatus === 'rejected'
          ? 'Your ID was rejected — resubmit to get verified'
          : 'Get ID-verified to build trust on the map',
      cta: idStatus === 'rejected' ? 'Resubmit' : 'Verify',
      target: 'VerificationId',
      cooldownDays: 3,
    });
  }

  if (STREAK_MILESTONES.includes(currentStreak)) {
    candidates.push({
      id: 'streak-milestone',
      icon: 'fire',
      accent: '#ff9d3c',
      label: 'Streak',
      title: streakTitle(currentStreak),
      cta: 'View',
      target: 'Challenges',
      cooldownDays: 1,
    });
  }

  return (
    candidates.find((c) => {
      const last = dismissed[c.id];
      return !last || now - last >= c.cooldownDays * DAY_MS;
    }) ?? null
  );
}

interface UseNudgesResult {
  /** Highest-priority active nudge, or null when nothing to show. */
  nudge: Nudge | null;
  /** Persist a dismissal; the nudge is hidden for its cooldown window. */
  dismiss: (id: string) => void;
}

export function useNudges(): UseNudgesResult {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.profile);
  const initialized = useAppSelector((s) => s.profile.initialized);
  const { summary } = useGamification();
  const [dismissed, setDismissed] = useState<DismissMap>({});
  // Wall-clock is impure in render, so capture it in state and refresh it only
  // in the async/event callbacks that change eligibility (initial load + each
  // dismiss). Keeps cooldown math out of the render body.
  const [now, setNow] = useState(0);

  // The Map surface doesn't otherwise load the profile; pull it once so the
  // verification nudge has data without forcing the user onto the Profile tab.
  useEffect(() => {
    if (!initialized) void dispatch(fetchProfile());
  }, [initialized, dispatch]);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DISMISS_KEY);
        if (raw) setDismissed(JSON.parse(raw) as DismissMap);
      } catch {
        // ignore corrupt/missing storage — nudges just aren't suppressed
      } finally {
        setNow(Date.now());
      }
    })();
  }, []);

  const dismiss = useCallback(
    (id: string) => {
      const ts = Date.now();
      setNow(ts);
      setDismissed((prev) => {
        const next = { ...prev, [id]: ts };
        void AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [],
  );

  // Verification (trust) outranks the streak celebration; see selectNudge.
  const nudge = useMemo<Nudge | null>(
    () =>
      selectNudge({
        idVerificationStatus: profile?.idVerificationStatus,
        createdAt: profile?.createdAt,
        currentStreak: summary?.currentStreak ?? 0,
        dismissed,
        now,
      }),
    [profile?.idVerificationStatus, profile?.createdAt, summary?.currentStreak, dismissed, now],
  );

  return { nudge, dismiss };
}
