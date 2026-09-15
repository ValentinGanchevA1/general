// apps/mobile/src/features/nudges/useNudges.ts
//
// Map activation + trust ladder nudges (ROADMAP P3.1 / activation).
// Derives 0–1 contextual nudge from profile badges + gamification streak.
// Priority: email → phone → ID → streak milestone.
// Dismissals persist with per-nudge cooldown (no net-new backend).

import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { IdVerificationStatus } from '@g88/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { useGamification } from '@/features/gamification/useGamification';
import { colors } from '@/theme';

/** Logical screens a nudge can deep-link to (resolved via openRootScreen). */
export type NudgeTarget =
  | 'EmailVerification'
  | 'Verification'
  | 'VerificationId'
  | 'Challenges';

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
// Soft hold before phone/ID nudges (explore first). Email is earlier — stories/chat soft gates.
const VERIFY_EMAIL_MIN_AGE_MS = 1 * DAY_MS;
const VERIFY_PHONE_MIN_AGE_MS = 2 * DAY_MS;
const VERIFY_ID_MIN_AGE_MS = 2 * DAY_MS;
// Streak days worth celebrating (secured by foreground ping — no daily nag).
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

function streakTitle(streak: number): string {
  if (streak >= 100) return `🔥 ${streak}-day streak — legendary!`;
  if (streak >= 30) return `🔥 ${streak}-day streak — incredible!`;
  if (streak >= 7) return `🔥 ${streak}-day streak — you're on fire!`;
  return `🔥 ${streak}-day streak — nice work!`;
}

type DismissMap = Record<string, number>; // nudge id → epoch ms of last dismiss

/** Inputs for pure selectNudge (unit-tested). */
export interface NudgeInputs {
  /** badges.email — true when email verified. */
  emailVerified: boolean;
  /** badges.phone — true when phone verified. */
  phoneVerified: boolean;
  idVerificationStatus: IdVerificationStatus | string | undefined;
  /** ISO account-creation timestamp, for age gates. */
  createdAt: string | undefined;
  currentStreak: number;
  /** nudge id → epoch ms of last dismissal. */
  dismissed: DismissMap;
  /** Captured wall-clock (epoch ms). */
  now: number;
}

function accountAgeMs(createdAt: string | undefined, now: number): number {
  if (!createdAt) return 0;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, now - t);
}

/**
 * Pure nudge selection: candidate list in priority order (activation ladder
 * outranks streak) and return the first that applies and isn't on cooldown.
 */
export function selectNudge({
  emailVerified,
  phoneVerified,
  idVerificationStatus: idStatus,
  createdAt,
  currentStreak,
  dismissed,
  now,
}: NudgeInputs): Nudge | null {
  const candidates: Nudge[] = [];
  const age = accountAgeMs(createdAt, now);

  // 1) Email — earliest activation step (story soft gate + trust baseline).
  if (!emailVerified && age >= VERIFY_EMAIL_MIN_AGE_MS) {
    candidates.push({
      id: 'verify-email',
      icon: 'email-check-outline',
      accent: colors.primary,
      label: 'Trust',
      title: 'Verify your email to unlock stories and more reach',
      cta: 'Verify',
      target: 'EmailVerification',
      cooldownDays: 2,
    });
  }

  // 2) Phone — after email is done (or never had email path blocked).
  if (emailVerified && !phoneVerified && age >= VERIFY_PHONE_MIN_AGE_MS) {
    candidates.push({
      id: 'verify-phone',
      icon: 'cellphone-check',
      accent: colors.primary,
      label: 'Trust',
      title: 'Add a verified phone for stronger identity on the map',
      cta: 'Add phone',
      target: 'Verification',
      cooldownDays: 3,
    });
  }

  // 3) ID — after phone when possible; rejected always bypasses age.
  const idNone = idStatus === 'none' || idStatus == null || idStatus === undefined;
  const idRejected = idStatus === 'rejected';
  if (
    emailVerified &&
    phoneVerified &&
    ((idNone && age >= VERIFY_ID_MIN_AGE_MS) || idRejected)
  ) {
    candidates.push({
      id: 'verify-id',
      icon: 'shield-alert',
      accent: colors.entityEvent,
      label: 'Verification',
      title: idRejected
        ? 'Your ID was rejected — resubmit to get verified'
        : 'Get ID-verified to build trust on the map',
      cta: idRejected ? 'Resubmit' : 'Verify',
      target: 'VerificationId',
      cooldownDays: 3,
    });
  }

  // 4) Streak milestone celebration (lowest priority).
  if (STREAK_MILESTONES.includes(currentStreak)) {
    candidates.push({
      id: 'streak-milestone',
      icon: 'fire',
      accent: colors.warning,
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
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!initialized) void dispatch(fetchProfile());
  }, [initialized, dispatch]);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DISMISS_KEY);
        if (raw) setDismissed(JSON.parse(raw) as DismissMap);
      } catch {
        // ignore corrupt/missing storage
      } finally {
        setNow(Date.now());
      }
    })();
  }, []);

  const dismiss = useCallback((id: string) => {
    const ts = Date.now();
    setNow(ts);
    setDismissed((prev) => {
      const next = { ...prev, [id]: ts };
      void AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const emailVerified = profile?.badges?.email === true;
  const phoneVerified = profile?.badges?.phone === true;
  const idStatus = profile?.idVerificationStatus;
  const createdAt = profile?.createdAt;

  const nudge = useMemo<Nudge | null>(
    () =>
      now === 0
        ? null
        : selectNudge({
            emailVerified,
            phoneVerified,
            idVerificationStatus: idStatus,
            createdAt,
            currentStreak: summary?.currentStreak ?? 0,
            dismissed,
            now,
          }),
    [
      emailVerified,
      phoneVerified,
      idStatus,
      createdAt,
      summary?.currentStreak,
      dismissed,
      now,
    ],
  );

  return { nudge, dismiss };
}
