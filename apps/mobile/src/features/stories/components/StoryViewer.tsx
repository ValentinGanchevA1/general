import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Video, { type OnLoadData, type OnProgressData } from 'react-native-video';

import type { StoryCard, StoryReactionKind } from '@g88/shared';
import { STORY_LIMITS } from '@g88/shared';

import { colors } from '@/theme';
import { useAppDispatch } from '@/hooks/redux';
import { reactToStory, recordStoryView } from '../storiesSlice';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const IMAGE_PROGRESS_MS = 5_000;
const VIDEO_SAFETY_MS = (STORY_LIMITS.videoMaxSeconds + 3) * 1_000;

interface Props {
  stories: StoryCard[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

/** Full-screen sequential story viewer with animated progress, hold-to-pause, mute. */
export function StoryViewer({ stories, initialIndex, visible, onClose }: Props) {
  const dispatch = useAppDispatch();
  const [index, setIndex] = useState(initialIndex);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [chromeDimmed, setChromeDimmed] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressValue = useRef(0);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);
  const durationMsRef = useRef(IMAGE_PROGRESS_MS);
  const safetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = stories[index];
  const storyId = current?.id;
  const mediaType = current?.mediaType;

  const clearSafety = () => {
    if (safetyTimer.current) {
      clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  };

  const goNext = useCallback(() => {
    animRef.current?.stop();
    clearSafety();
    if (index < stories.length - 1) setIndex((i) => i + 1);
    else onClose();
  }, [index, stories.length, onClose]);

  const goPrev = useCallback(() => {
    animRef.current?.stop();
    clearSafety();
    if (index > 0) setIndex((i) => i - 1);
  }, [index]);

  useEffect(() => {
    const id = progressAnim.addListener(({ value }) => {
      progressValue.current = value;
    });
    return () => {
      progressAnim.removeListener(id);
    };
  }, [progressAnim]);

  useEffect(() => {
    if (!visible) return;
    void Promise.resolve().then(() => {
      setIndex(initialIndex);
      setPaused(false);
      setChromeDimmed(false);
    });
  }, [visible, initialIndex]);

  const startImageProgress = useCallback(
    (from: number) => {
      animRef.current?.stop();
      const duration = durationMsRef.current;
      const remaining = Math.max(80, duration * (1 - from));
      progressAnim.setValue(from);
      animRef.current = Animated.timing(progressAnim, {
        toValue: 1,
        duration: remaining,
        useNativeDriver: false,
      });
      animRef.current.start(({ finished }) => {
        if (finished) goNext();
      });
    },
    [progressAnim, goNext],
  );

  // Reset progress + timers when story changes
  useEffect(() => {
    if (!visible || !storyId) return;
    void dispatch(recordStoryView(storyId));
    setPaused(false);
    setChromeDimmed(false);
    progressAnim.setValue(0);
    progressValue.current = 0;
    animRef.current?.stop();
    clearSafety();

    if (mediaType === 'video') {
      durationMsRef.current = VIDEO_SAFETY_MS;
      // Safety only — real advance is onEnd / onProgress completion
      safetyTimer.current = setTimeout(goNext, VIDEO_SAFETY_MS);
    } else {
      durationMsRef.current = IMAGE_PROGRESS_MS;
      startImageProgress(0);
    }

    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChromeDimmed(true), 1_200);

    return () => {
      animRef.current?.stop();
      clearSafety();
      if (chromeTimer.current) clearTimeout(chromeTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, storyId, index, mediaType, dispatch, goNext, startImageProgress]);

  const onHoldStart = () => {
    setPaused(true);
    setChromeDimmed(false);
    if (mediaType === 'image') {
      animRef.current?.stop();
    }
  };

  const onHoldEnd = () => {
    setPaused(false);
    if (mediaType === 'image') {
      startImageProgress(progressValue.current);
    }
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChromeDimmed(true), 1_200);
  };

  if (!current) return null;

  const onReact = (kind: StoryReactionKind) => {
    void dispatch(reactToStory({ storyId: current.id, kind }));
  };

  const onVideoEnd = () => {
    clearSafety();
    goNext();
  };

  const onVideoLoad = (data: OnLoadData) => {
    clearSafety();
    const durationMs = Math.min(
      Math.ceil((data.duration || STORY_LIMITS.videoMaxSeconds) * 1000) + 1_000,
      VIDEO_SAFETY_MS,
    );
    durationMsRef.current = durationMs;
    safetyTimer.current = setTimeout(goNext, durationMs);
  };

  const onVideoProgress = (data: OnProgressData) => {
    const total = data.seekableDuration || data.playableDuration;
    if (total > 0) {
      progressAnim.setValue(Math.min(1, data.currentTime / total));
    }
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <View style={[styles.progressRow, chromeDimmed && styles.chromeDim]}>
          {stories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              {i < index ? (
                <View style={[styles.progressFill, styles.progressDone]} />
              ) : i === index ? (
                <Animated.View
                  style={[
                    styles.progressFill,
                    {
                      width: progressAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: ['0%', '100%'],
                      }),
                    },
                  ]}
                />
              ) : (
                <View style={styles.progressFill} />
              )}
            </View>
          ))}
        </View>

        <View style={[styles.header, chromeDimmed && styles.chromeDim]}>
          <Text style={styles.author}>{current.authorDisplayName}</Text>
          <View style={styles.headerRight}>
            {mediaType === 'video' ? (
              <Pressable
                onPress={() => setMuted((m) => !m)}
                hitSlop={12}
                accessibilityLabel={muted ? 'Unmute' : 'Mute'}
              >
                <Text style={styles.mute}>{muted ? '🔇' : '🔊'}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.mediaWrap}>
          <Pressable
            style={styles.tapLeft}
            onPress={goPrev}
            onLongPress={onHoldStart}
            onPressOut={onHoldEnd}
            delayLongPress={150}
          />
          <Pressable
            style={styles.tapRight}
            onPress={goNext}
            onLongPress={onHoldStart}
            onPressOut={onHoldEnd}
            delayLongPress={150}
          />
          {current.mediaType === 'image' ? (
            <Image source={{ uri: current.mediaUrl }} style={styles.media} resizeMode="cover" />
          ) : (
            <Video
              key={current.id}
              source={{ uri: current.mediaUrl }}
              style={styles.media}
              resizeMode="cover"
              controls={false}
              muted={muted}
              repeat={false}
              paused={!visible || paused}
              playInBackground={false}
              playWhenInactive={false}
              ignoreSilentSwitch="ignore"
              onEnd={onVideoEnd}
              onLoad={onVideoLoad}
              onProgress={onVideoProgress}
              onError={() => {
                clearSafety();
                safetyTimer.current = setTimeout(goNext, 1_500);
              }}
            />
          )}
        </View>

        {current.caption ? (
          <Text
            style={[styles.caption, chromeDimmed && styles.chromeDim]}
            numberOfLines={3}
          >
            {current.caption}
          </Text>
        ) : null}

        <View style={[styles.reactions, chromeDimmed && styles.chromeDim]}>
          <Pressable
            style={[styles.reactBtn, current.myReaction === 'heart' && styles.reactActive]}
            onPress={() => onReact('heart')}
          >
            <Text style={styles.reactEmoji}>💛</Text>
          </Pressable>
          <Pressable
            style={[styles.reactBtn, current.myReaction === 'wave' && styles.reactActive]}
            onPress={() => onReact('wave')}
          >
            <Text style={styles.reactEmoji}>👋</Text>
          </Pressable>
          <Text style={styles.counts}>
            {current.viewCount} views · {current.reactionCount} reacts
          </Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', paddingTop: 48 },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 12 },
  progressTrack: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressFill: { height: 2, width: 0, backgroundColor: '#fff' },
  progressDone: { width: '100%' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  author: { color: colors.textPrimary, fontWeight: '600', fontSize: 15 },
  mute: { fontSize: 18 },
  close: { color: colors.textPrimary, fontSize: 18 },
  chromeDim: { opacity: 0.35 },
  mediaWrap: { flex: 1, justifyContent: 'center' },
  media: { width: SCREEN_W, height: SCREEN_H * 0.65 },
  tapLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: '30%',
    zIndex: 2,
  },
  tapRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: '70%',
    zIndex: 2,
  },
  caption: {
    color: colors.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
  },
  reactions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 36,
    gap: 12,
  },
  reactBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactActive: { backgroundColor: 'rgba(124,92,255,0.4)' },
  reactEmoji: { fontSize: 22 },
  counts: { color: colors.textSecondary, fontSize: 12, marginLeft: 8 },
});
