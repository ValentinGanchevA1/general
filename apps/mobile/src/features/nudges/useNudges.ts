// apps/mobile/src/features/nudges/useNudges.ts
//
// Map activation + trust ladder nudges (ROADMAP P3.1 / activation).
// Derives 0–1 contextual nudge from profile badges + gamification streak.
// Priority: post-social boost → email → phone → ID → streak milestone.
// Post-social (after Wave/Message) bypasses age gates for the next trust step.
// Dismissals persist with per-nudge cooldown (no net-new backend).
// Trust ladder step comes from shared resolveTrustNextStep (Profile + Settings).

import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { IdVerificationStatus } from '@g88/shared';
import { resolveTrustNextStep } from '@g88/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { useGamification } from '@/features/gamification/useGamification';
import { colors } from '@/theme';

import {
  clearPostSocialActivation,
  getPostSocialActivation,
  isPostSocialActive,
  subscribePostSocialActivation,
  type PostSocialPayload,
} from './postSocialActivation';

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
const VERIFY_EMAIL_MIN_AGE_MS = 1 * DAY_MS;
const VERIFY_PHONE_MIN_AGE_MS = 2 * DAY_MS;
const VERIFY_ID_MIN_AGE_MS = 2 * DAY_MS;
const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100, 180, 365];

function streakTitle(streak: number): string {
  if (streak >= 100) return `🔥 ${streak}-day streak — legendary!`;
  if (streak >= 30) return `🔥 ${streak}-day streak — incredible!`;
  if (streak >= 7) return `🔥 ${streak}-day streak — you're on fire!`;
  return `🔥 ${streak}-day streak — nice work!`;
}

type DismissMap = Record<string, number>;

/** Inputs for pure selectNudge (unit-tested). */
export interface NudgeInputs {
  emailVerified: boolean;
  phoneVerified: boolean;
  idVerificationStatus: IdVerificationStatus | string | undefined;
  createdAt: string | undefined;
  currentStreak: number;
  dismissed: DismissMap;
  now: number;
  postSocial?: PostSocialPayload | null;
}

function accountAgeMs(createdAt: string | undefined, now: number): number {
  if (!createdAt) return 0;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, now - t);
}

export function selectNudge({
  emailVerified,
  phoneVerified,
  idVerificationStatus: idStatus,
  createdAt,
  currentStreak,
  dismissed,
  now,
  postSocial = null,
}: NudgeInputs): Nudge | null {
  const candidates: Nudge[] = [];
  const age = accountAgeMs(createdAt, now);
  const socialBoost = isPostSocialActive(postSocial, now);
  const verb = postSocial?.source === 'message' ? 'messaged someone' : 'connected nearby';

  const trust = resolveTrustNextStep({
    emailVerified,
    phoneVerified,
    ...(idStatus === 'none' ||
    idStatus === 'pending' ||
    idStatus === 'verified' ||
    idStatus === 'rejected'
      ? { idStatus }
      : {}),
  });

  const trustNudgeBase = (): Nudge | null => {
    if (trust.kind !== 'actionable' || trust.step == null || trust.nav == null) {
      return null;
    }
    if (trust.step === 'email') {
      return {
        id: 'verify-email',
        icon: 'email-check-outline',
        accent: colors.primary,
        label: 'Trust',
        title: 'Verify your email to unlock stories and more reach',
        cta: 'Verify',
        target: 'EmailVerification',
        cooldownDays: 2,
      };
    }
    if (trust.step === 'phone') {
      return {
        id: 'verify-phone',
        icon: 'cellphone-check',
        accent: colors.primary,
        label: 'Trust',
        title: 'Add a verified phone for stronger identity on the map',
        cta: 'Add phone',
        target: 'Verification',
        cooldownDays: 3,
      };
    }
    const rejected = idStatus === 'rejected';
    return {
      id: 'verify-id',
      icon: 'shield-alert',
      accent: colors.entityEvent,
      label: 'Verification',
      title: rejected
        ? 'Your ID was rejected — resubmit to get verified'
        : 'Get ID-verified to build trust on the map',
      cta: rejected ? 'Resubmit' : 'Verify',
      target: 'VerificationId',
      cooldownDays: 3,
    };
  };

  if (socialBoost) {
    const base = trustNudgeBase();
    if (base) {
      if (base.id === 'verify-email') {
        candidates.push({
          ...base,
          title: `You just ${verb} — verify email so people can trust you`,
        });
      } else if (base.id === 'verify-phone') {
        candidates.push({
          ...base,
          title: `You just ${verb} — add a phone for stronger identity`,
        });
      } else {
        candidates.push({
          ...base,
          title:
            idStatus === 'rejected'
              ? 'Your ID was rejected — resubmit to get verified'
              : `You're active nearby — get ID-verified for the trust badge`,
        });
      }
    }
  }

  if (trust.kind === 'actionable' && trust.step != null) {
    const base = trustNudgeBase();
    if (base) {
      if (trust.step === 'email' && age >= VERIFY_EMAIL_MIN_AGE_MS) {
        candidates.push(base);
      } else if (trust.step === 'phone' && age >= VERIFY_PHONE_MIN_AGE_MS) {
        candidates.push(base);
      } else if (trust.step === 'id') {
        const idRejected = idStatus === 'rejected';
        if (idRejected || age >= VERIFY_ID_MIN_AGE_MS) {
          candidates.push(base);
        }
      }
    }
  }

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

  const seen = new Set<string>();
  const ordered: Nudge[] = [];
  for (const c of candidates) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    ordered.push(c);
  }

  return (
    ordered.find((c) => {
      const last = dismissed[c.id];
      return !last || now - last >= c.cooldownDays * DAY_MS;
    }) ?? null
  );
}

interface UseNudgesResult {
  nudge: Nudge | null;
  dismiss: (id: string) => void;
}

export function useNudges(): UseNudgesResult {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.profile);
  const initialized = useAppSelector((s) => s.profile.initialized);
  const { summary } = useGamification();
  const [dismissed, setDismissed] = useState<DismissMap>({});
  const [now, setNow] = useState(0);
  const [postSocial, setPostSocial] = useState<PostSocialPayload | null>(null);

  useEffect(() => {
    if (!initialized) void dispatch(fetchProfile());
  }, [initialized, dispatch]);

  const refreshPostSocial = useCallback(() => {
    void (async () => {
      const p = await getPostSocialActivation();
      setPostSocial(p);
      setNow(Date.now());
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(DISMISS_KEY);
        if (raw) setDismissed(JSON.parse(raw) as DismissMap);
      } catch {
        // ignore
      } finally {
        setNow(Date.now());
      }
    })();
    refreshPostSocial();
    return subscribePostSocialActivation(refreshPostSocial);
  }, [refreshPostSocial]);

  const dismiss = useCallback((id: string) => {
    const ts = Date.now();
    setNow(ts);
    setDismissed((prev) => {
      const next = { ...prev, [id]: ts };
      void AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
    if (id === 'verify-email' || id === 'verify-phone' || id === 'verify-id') {
      void clearPostSocialActivation();
      setPostSocial(null);
    }
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
            postSocial,
          }),
    [
      emailVerified,
      phoneVerified,
      idStatus,
      createdAt,
      summary?.currentStreak,
      dismissed,
      now,
      postSocial,
    ],
  );

  return { nudge, dismiss };
}
