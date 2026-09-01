import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

import { appAlert } from '@/ui/appAlert';
import {
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import Video from 'react-native-video';

import type { StoryCard, StoryReactionKind } from '@g88/shared';

import { colors } from '@/theme';
import { useAppDispatch } from '@/hooks/redux';
import {
  ActionSheetList,
  sheetChrome,
  useSheetBackdrop,
} from '@/components/sheets';
import { reactToStory, recordStoryView } from '../storiesSlice';
import { useStoryProgress } from './useStoryProgress';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

interface Props {
  stories: StoryCard[];
  initialIndex: number;
  visible: boolean;
  onClose: () => void;
}

/** Full-screen sequential story viewer — progress logic lives in useStoryProgress. */
export function StoryViewer({ stories, initialIndex, visible, onClose }: Props) {
  const dispatch = useAppDispatch();
  const [index, setIndex] = useState(initialIndex);
  const [held, setHeld] = useState(false);
  const [muted, setMuted] = useState(false);
  const [chromeDimmed, setChromeDimmed] = useState(false);
  const chromeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionsRef = useRef<BottomSheetModal>(null);
  const optionsSnap = useMemo(() => ['22%'], []);
  const renderBackdrop = useSheetBackdrop(0.45);

  const current = stories[index];
  const storyId = current?.id;
  const mediaType = current?.mediaType;

  const goNext = useCallback(() => {
    setIndex((i) => {
      if (i < stories.length - 1) return i + 1;
      void Promise.resolve().then(() => onClose());
      return i;
    });
  }, [stories.length, onClose]);

  const goPrev = useCallback(() => {
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const { progressAnim, onVideoLoad, onVideoProgress, onVideoEnd, onVideoError, hardStop } =
    useStoryProgress({
      visible,
      storyId,
      mediaType,
      held,
      onComplete: goNext,
    });

  useEffect(() => {
    if (!visible) return;
    void Promise.resolve().then(() => {
      setIndex(initialIndex);
      setHeld(false);
      setChromeDimmed(false);
    });
  }, [visible, initialIndex]);

  useEffect(() => {
    if (!visible || !storyId) return;
    void dispatch(recordStoryView(storyId));
    void Promise.resolve().then(() => {
      setHeld(false);
      setChromeDimmed(false);
    });
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChromeDimmed(true), 1_200);
    return () => {
      if (chromeTimer.current) clearTimeout(chromeTimer.current);
    };
  }, [visible, storyId, index, dispatch]);

  const scheduleChromeDim = () => {
    if (chromeTimer.current) clearTimeout(chromeTimer.current);
    chromeTimer.current = setTimeout(() => setChromeDimmed(true), 1_200);
  };

  const onHoldStart = () => {
    setHeld(true);
    setChromeDimmed(false);
  };

  const onHoldEnd = () => {
    setHeld(false);
    scheduleChromeDim();
  };

  const onTapNav = (dir: 'prev' | 'next') => {
    hardStop();
    if (dir === 'prev') goPrev();
    else goNext();
  };

  const openOptions = () => {
    setHeld(true);
    optionsRef.current?.present();
  };

  if (!current) return null;

  const onReact = (kind: StoryReactionKind) => {
    void dispatch(reactToStory({ storyId: current.id, kind }));
  };

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.root}>
        <ProgressRow
          stories={stories}
          index={index}
          progressAnim={progressAnim}
          dimmed={chromeDimmed}
        />

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
            <Pressable onPress={openOptions} hitSlop={12} accessibilityLabel="Story options">
              <Text style={styles.more}>···</Text>
            </Pressable>
            <Pressable onPress={onClose} hitSlop={12}>
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.mediaWrap}>
          <Pressable
            style={styles.tapLeft}
            onPress={() => onTapNav('prev')}
            onLongPress={onHoldStart}
            onPressOut={onHoldEnd}
            delayLongPress={150}
          />
          <Pressable
            style={styles.tapRight}
            onPress={() => onTapNav('next')}
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
              paused={!visible || held}
              playInBackground={false}
              playWhenInactive={false}
              ignoreSilentSwitch="ignore"
              onEnd={onVideoEnd}
              onLoad={onVideoLoad}
              onProgress={onVideoProgress}
              onError={onVideoError}
            />
          )}
        </View>

        {current.caption ? (
          <Text style={[styles.caption, chromeDimmed && styles.chromeDim]} numberOfLines={3}>
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

        <BottomSheetModal
          ref={optionsRef}
          snapPoints={optionsSnap}
          enablePanDownToClose
          enableDynamicSizing={false}
          backdropComponent={renderBackdrop}
          backgroundStyle={sheetChrome.background}
          handleIndicatorStyle={sheetChrome.handle}
          onDismiss={() => {
            setHeld(false);
            scheduleChromeDim();
          }}
        >
          <BottomSheetView style={sheetChrome.content}>
            <ActionSheetList
              title="Story"
              items={[
                {
                  key: 'report',
                  label: 'Report story',
                  icon: 'flag-outline',
                  destructive: true,
                  onPress: () => {
                    optionsRef.current?.dismiss();
                    appAlert(
                      'Report submitted',
                      'Thanks — we will review this story.',
                    );
                  },
                },
              ]}
            />
          </BottomSheetView>
        </BottomSheetModal>
      </View>
    </Modal>
  );
}

function ProgressRow({
  stories,
  index,
  progressAnim,
  dimmed,
}: {
  stories: StoryCard[];
  index: number;
  progressAnim: Animated.Value;
  dimmed: boolean;
}) {
  return (
    <View style={[styles.progressRow, dimmed && styles.chromeDim]}>
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
  more: { color: colors.textPrimary, fontSize: 18, letterSpacing: 1 },
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
