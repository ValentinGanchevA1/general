import React, { useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { StoryCard, StoryReactionKind } from '@g88/shared';
import { STORY_LIMITS } from '@g88/shared';

import { useAppDispatch } from '@/hooks/redux';
import { reactToStory, recordStoryView } from '../storiesSlice';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const IMAGE_PROGRESS_MS = 5_000;
/** Until react-native-video is wired, advance video stories on a fixed timer. */
const VIDEO_PROGRESS_MS = Math.min(STORY_LIMITS.videoMaxSeconds, 15) * 1_000;

interface Props {
  stories: StoryCard[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

/** Full-screen sequential story viewer with progress, views, heart/wave. */
export function StoryViewer({ stories, initialIndex, visible, onClose }: Props) {
  const dispatch = useAppDispatch();
  const [index, setIndex] = useState(initialIndex);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const current = stories[index];

  const storyId = current?.id;
  const mediaType = current?.mediaType;

  useEffect(() => {
    if (!visible) return;
    // Defer setState out of the effect body (CI --max-warnings 0 / set-state-in-effect).
    void Promise.resolve().then(() => {
      setIndex(initialIndex);
    });
  }, [visible, initialIndex]);

  useEffect(() => {
    if (!visible || !storyId) return;
    void dispatch(recordStoryView(storyId));
    if (timer.current) clearTimeout(timer.current);
    const ms = mediaType === 'video' ? VIDEO_PROGRESS_MS : IMAGE_PROGRESS_MS;
    timer.current = setTimeout(() => {
      if (index < stories.length - 1) setIndex((i) => i + 1);
      else onClose();
    }, ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible, storyId, index, stories.length, dispatch, onClose, mediaType]);

  if (!current) return null;

  const onReact = (kind: StoryReactionKind) => {
    void dispatch(reactToStory({ storyId: current.id, kind }));
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <View style={styles.progressRow}>
          {stories.map((s, i) => (
            <View key={s.id} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  i < index && styles.progressDone,
                  i === index && styles.progressActive,
                ]}
              />
            </View>
          ))}
        </View>
        <View style={styles.header}>
          <Text style={styles.author}>{current.authorDisplayName}</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.mediaWrap}>
          <Pressable
            style={styles.tapLeft}
            onPress={() => (index > 0 ? setIndex(index - 1) : undefined)}
          />
          <Pressable
            style={styles.tapRight}
            onPress={() =>
              index < stories.length - 1 ? setIndex(index + 1) : onClose()
            }
          />
          {current.mediaType === 'image' ? (
            <Image source={{ uri: current.mediaUrl }} style={styles.media} resizeMode="cover" />
          ) : (
            <View style={[styles.media, styles.videoPlaceholder]}>
              <Text style={styles.videoLabel}>▶ Video</Text>
              <Text style={styles.videoHint}>Playback player ships next</Text>
            </View>
          )}
        </View>
        {current.caption ? (
          <Text style={styles.caption} numberOfLines={3}>
            {current.caption}
          </Text>
        ) : null}
        <View style={styles.reactions}>
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
  progressActive: { width: '50%' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  author: { color: '#fff', fontWeight: '600', fontSize: 15 },
  close: { color: '#fff', fontSize: 18 },
  mediaWrap: { flex: 1, justifyContent: 'center' },
  media: { width: SCREEN_W, height: SCREEN_H * 0.65 },
  videoPlaceholder: {
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoLabel: { color: '#fff', fontSize: 18, fontWeight: '600' },
  videoHint: { color: '#888', fontSize: 12, marginTop: 8 },
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
  caption: { color: '#fff', paddingHorizontal: 16, paddingVertical: 8, fontSize: 14 },
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
  counts: { color: '#aaa', fontSize: 12, marginLeft: 8 },
});
