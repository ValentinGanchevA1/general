import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

import type { StoryCard } from '@g88/shared';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { colors } from '@/theme';
import { fetchAuthorStories } from '../storiesSlice';
import { StoryViewer } from './StoryViewer';

interface Props {
  userId: string;
  /** Own profile — softer empty copy. */
  isSelf?: boolean;
}

function isActive(s: StoryCard, now = Date.now()): boolean {
  return new Date(s.expiresAt).getTime() > now;
}

/** Stable empty ref — avoids "Selector unknown returned a different result" when byAuthor misses. */
const EMPTY_STORIES: StoryCard[] = [];

/**
 * Profile wall: active + recent expired stories (timeline).
 * Captions overlay the thumbnail via bottom gradient so labels never get lost
 * when images scale or layout shifts.
 */
export function ProfileStoryline({ userId, isSelf = false }: Props): React.JSX.Element {
  const dispatch = useAppDispatch();
  const stories = useAppSelector((s) => s.stories.byAuthor[userId] ?? EMPTY_STORIES);
  const [loading, setLoading] = useState(true);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await dispatch(
        fetchAuthorStories({ authorId: userId, includeExpired: true, limit: 50 }),
      ).unwrap();
    } catch {
      // keep previous
    } finally {
      setLoading(false);
    }
  }, [dispatch, userId]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void load();
    });
  }, [load]);

  const sorted = useMemo(
    () => [...stories].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
    [stories],
  );

  const openAt = (index: number): void => {
    setViewerIndex(index);
    setViewerOpen(true);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Storyline</Text>
        <Text style={styles.hint}>Active + recent</Text>
      </View>

      {loading && sorted.length === 0 ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : sorted.length === 0 ? (
        <Text style={styles.empty}>
          {isSelf
            ? 'Your storyline is empty — share a moment from the map.'
            : 'No stories yet.'}
        </Text>
      ) : (
        <FlatList
          horizontal
          data={sorted}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const live = isActive(item);
            const label = item.caption
              ? item.caption
              : live
                ? 'Active'
                : 'Earlier';
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openAt(index)}
                activeOpacity={0.85}
              >
                <View style={styles.thumbWrap}>
                  <Image source={{ uri: item.mediaUrl }} style={styles.thumb} />
                  {live ? (
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveText}>Live</Text>
                    </View>
                  ) : null}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.75)']}
                    style={styles.captionGradient}
                    pointerEvents="none"
                  >
                    <Text
                      style={item.caption ? styles.caption : styles.captionMuted}
                      numberOfLines={2}
                    >
                      {label}
                    </Text>
                  </LinearGradient>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <StoryViewer
        stories={sorted}
        initialIndex={viewerIndex}
        visible={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  title: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  hint: { color: colors.textMuted, fontSize: 12 },
  loader: { marginVertical: 16 },
  empty: {
    color: colors.textMuted,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
    lineHeight: 18,
  },
  list: { paddingHorizontal: 12, gap: 10 },
  card: { width: 112, marginHorizontal: 4 },
  thumbWrap: {
    width: 112,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.surfaceRaised,
  },
  thumb: {
    width: 112,
    height: 160,
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: colors.primary,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 2,
  },
  liveText: { color: colors.onPrimary, fontSize: 10, fontWeight: '800' },
  captionGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingTop: 28,
    paddingBottom: 8,
    justifyContent: 'flex-end',
  },
  caption: {
    color: '#ffffff',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  captionMuted: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
