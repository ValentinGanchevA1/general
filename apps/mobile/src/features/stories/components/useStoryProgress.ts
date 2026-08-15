import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';
import type { OnLoadData, OnProgressData } from 'react-native-video';

import { STORY_LIMITS } from '@g88/shared';

const IMAGE_PROGRESS_MS = 5_000;
const VIDEO_SAFETY_MS = (STORY_LIMITS.videoMaxSeconds + 3) * 1_000;

export type StoryMediaKind = 'image' | 'video';

interface Args {
  visible: boolean;
  storyId: string | undefined;
  mediaType: StoryMediaKind | undefined;
  /** When true, image timing freezes; video uses external `paused` prop. */
  held: boolean;
  onComplete: () => void;
}

/**
 * Owns progress bar animation + image dwell / video safety timers.
 * Callers drive hold via `held`; advance via `onComplete`.
 */
export function useStoryProgress({
  visible,
  storyId,
  mediaType,
  held,
  onComplete,
}: Args) {
  const [progressAnim] = useState(() => new Animated.Value(0));
  const progressValue = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const durationMsRef = useRef(IMAGE_PROGRESS_MS);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onCompleteRef = useRef(onComplete);
  const heldRef = useRef(held);

  // Keep latest callbacks/flags in refs — update only in effects (react-hooks/refs).
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    heldRef.current = held;
  }, [held]);

  const clearSafety = useCallback(() => {
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  }, []);

  const stopAnim = useCallback(() => {
    animRef.current?.stop();
    animRef.current = null;
  }, []);

  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      progressValue.current = value;
    });
    return () => {
      progressAnim.removeListener(id);
    };
  }, [progressAnim]);

  const startImageProgress = useCallback(
    (from: number) => {
      stopAnim();
      const duration = durationMsRef.current;
      const remaining = Math.max(80, duration * (1 - from));
      progressAnim.setValue(from);
      const anim = Animated.timing(progressAnim, {
        toValue: 1,
        duration: remaining,
        useNativeDriver: false,
      });
      animRef.current = anim;
      anim.start(({ finished }) => {
        if (finished) onCompleteRef.current();
      });
    },
    [progressAnim, stopAnim],
  );

  // Reset + start when the active story changes (held via heldRef — avoid restart-on-hold).
  useEffect(() => {
    if (!visible || !storyId || !mediaType) return;

    stopAnim();
    clearSafety();
    progressAnim.setValue(0);
    progressValue.current = 0;

    if (mediaType === 'video') {
      durationMsRef.current = VIDEO_SAFETY_MS;
      safetyTimer.current = setTimeout(() => onCompleteRef.current(), VIDEO_SAFETY_MS);
    } else {
      durationMsRef.current = IMAGE_PROGRESS_MS;
      void Promise.resolve().then(() => {
        if (!heldRef.current) startImageProgress(0);
      });
    }

    return () => {
      stopAnim();
      clearSafety();
    };
  }, [visible, storyId, mediaType, progressAnim, stopAnim, clearSafety, startImageProgress]);

  // Pause / resume image progress when hold changes
  useEffect(() => {
    if (!visible || mediaType !== 'image') return;
    if (held) {
      stopAnim();
    } else if (progressValue.current < 1) {
      startImageProgress(progressValue.current);
    }
  }, [held, visible, mediaType, stopAnim, startImageProgress]);

  const onVideoLoad = useCallback(
    (data: OnLoadData) => {
      clearSafety();
      const durationMs = Math.min(
        Math.ceil((data.duration || STORY_LIMITS.videoMaxSeconds) * 1000) + 1_000,
        VIDEO_SAFETY_MS,
      );
      durationMsRef.current = durationMs;
      safetyTimer.current = setTimeout(() => onCompleteRef.current(), durationMs);
    },
    [clearSafety],
  );

  const onVideoProgress = useCallback(
    (data: OnProgressData) => {
      const total = data.seekableDuration || data.playableDuration;
      if (total > 0) {
        progressAnim.setValue(Math.min(1, data.currentTime / total));
      }
    },
    [progressAnim],
  );

  const onVideoEnd = useCallback(() => {
    clearSafety();
    onCompleteRef.current();
  }, [clearSafety]);

  const onVideoError = useCallback(() => {
    clearSafety();
    safetyTimer.current = setTimeout(() => onCompleteRef.current(), 1_500);
  }, [clearSafety]);

  const hardStop = useCallback(() => {
    stopAnim();
    clearSafety();
  }, [stopAnim, clearSafety]);

  return {
    progressAnim,
    onVideoLoad,
    onVideoProgress,
    onVideoEnd,
    onVideoError,
    hardStop,
  };
}
