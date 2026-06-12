// apps/mobile/src/features/nudges/useNudges.ts
//
// P3.1 leftover "nudges" — the last surfacing item on the gamification epic
// (ROADMAP P3.1: optional "complete your verification" / streak nudges, no
// net-new backend). Derives 0–1 contextual nudges purely from state the app
// already loads (profile badges + gamification streak) and returns the highest
// priority one for a banner to render. Dismissals are persisted with a per-nudge
// cooldown so a dismissed nudge stays gone for a few days instead of nagging.

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

type DismissMap = Record<string, number>; // nudge id → epoch ms of last dismiss

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

  // Candidate nudges in priority order; first one that applies + isn't on
  // cooldown wins. Verification (trust) outranks the streak reminder.
  const nudge = useMemo<Nudge | null>(() => {
    const candidates: Nudge[] = [];

    const idStatus = profile?.idVerificationStatus;
    if (idStatus === 'none' || idStatus === 'rejected') {
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

    const streak = summary?.currentStreak ?? 0;
    if (streak >= 3) {
      candidates.push({
        id: 'streak-keepalive',
        icon: 'fire',
        accent: '#ff9d3c',
        label: 'Streak',
        title: `🔥 ${streak}-day streak — keep it going today`,
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
  }, [profile?.idVerificationStatus, summary?.currentStreak, dismissed, now]);

  return { nudge, dismiss };
}
