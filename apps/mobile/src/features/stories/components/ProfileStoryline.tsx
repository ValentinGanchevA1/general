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

import type { StoryCard } from '@g88/shared';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
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

/**
 * Profile wall: active + recent expired stories (timeline).
 * Placed after Photos on Profile / UserProfile.
 */
export function ProfileStoryline({ userId, isSelf = false }: Props): React.JSX.Element {
  const dispatch = useAppDispatch();
  const stories = useAppSelector((s) => s.stories.byAuthor[userId] ?? []);
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
        <ActivityIndicator color="#00d4ff" style={styles.loader} />
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
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => openAt(index)}
                activeOpacity={0.85}
              >
                <Image source={{ uri: item.mediaUrl }} style={styles.thumb} />
                {live ? (
                  <View style={styles.liveBadge}>
                    <Text style={styles.liveText}>Live</Text>
                  </View>
                ) : null}
                {item.caption ? (
                  <Text style={styles.caption} numberOfLines={2}>
                    {item.caption}
                  </Text>
                ) : (
                  <Text style={styles.captionMuted} numberOfLines={1}>
                    {live ? 'Active' : 'Earlier'}
                  </Text>
                )}
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
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  hint: { color: '#666', fontSize: 12 },
  loader: { marginVertical: 16 },
  empty: {
    color: '#888',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
    lineHeight: 18,
  },
  list: { paddingHorizontal: 12, gap: 10 },
  card: { width: 112, marginHorizontal: 4 },
  thumb: {
    width: 112,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#1a1a24',
  },
  liveBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#00d4ff',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveText: { color: '#000', fontSize: 10, fontWeight: '800' },
  caption: { color: '#ccc', fontSize: 11, marginTop: 6, lineHeight: 14 },
  captionMuted: { color: '#666', fontSize: 11, marginTop: 6 },
});
