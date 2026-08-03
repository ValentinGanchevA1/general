import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { StoryCard } from '@g88/shared';

import { useAppSelector } from '@/hooks/redux';

interface Props {
  onOpenStory: (story: StoryCard, index: number) => void;
  onCreatePress: () => void;
}

/** Horizontal Pulse/Storyline strip for the map dashboard. */
export function PulseStrip({ onOpenStory, onCreatePress }: Props) {
  const stories = useAppSelector((s) => s.stories.nearby);
  const loading = useAppSelector((s) => s.stories.loading);

  const renderItem = useCallback(
    ({ item, index }: { item: StoryCard; index: number }) => {
      const unseen = !item.viewedByMe;
      return (
        <Pressable
          style={styles.item}
          onPress={() => onOpenStory(item, index)}
          accessibilityRole="button"
          accessibilityLabel={`Story by ${item.authorDisplayName}`}
        >
          <View style={[styles.ring, unseen ? styles.ringUnseen : styles.ringSeen]}>
            {item.authorAvatarUrl ? (
              <Image source={{ uri: item.authorAvatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>
                  {item.authorDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {item.authorDisplayName}
          </Text>
        </Pressable>
      );
    },
    [onOpenStory],
  );

  return (
    <View style={styles.wrap}>
      <FlatList
        horizontal
        data={stories}
        keyExtractor={(s) => s.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Pressable style={styles.item} onPress={onCreatePress}>
            <View style={[styles.ring, styles.ringCreate]}>
              <Text style={styles.plus}>+</Text>
            </View>
            <Text style={styles.name}>Your story</Text>
          </Pressable>
        }
        ListEmptyComponent={
          loading ? null : <Text style={styles.empty}>No stories nearby</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingVertical: 8 },
  list: { paddingHorizontal: 12, alignItems: 'flex-start' },
  item: { width: 72, alignItems: 'center', marginRight: 10 },
  ring: {
    width: 64,
    height: 64,
    borderRadius: 32,
    padding: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringUnseen: { borderWidth: 2, borderColor: '#7C5CFF' },
  ringSeen: { borderWidth: 2, borderColor: '#555' },
  ringCreate: { borderWidth: 2, borderColor: '#888', borderStyle: 'dashed' },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#333' },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 20, fontWeight: '600' },
  plus: { color: '#fff', fontSize: 28, fontWeight: '300' },
  name: {
    marginTop: 4,
    fontSize: 11,
    color: '#ddd',
    maxWidth: 72,
    textAlign: 'center',
  },
  empty: { color: '#888', fontSize: 13, paddingHorizontal: 8, alignSelf: 'center' },
});
