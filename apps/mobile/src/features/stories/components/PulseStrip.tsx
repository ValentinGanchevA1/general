import React, { useCallback } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '@/theme';

import type { StoryCard } from '@g88/shared';

import { useAppSelector } from '@/hooks/redux';

interface Props {
  onOpenStory: (story: StoryCard, index: number) => void;
  onCreatePress: () => void;
  /** When false, create ring is muted; host still receives onCreatePress for nudge. */
  canCreate?: boolean;
}

/**
 * Rendered height of the strip (padding + ring + name).
 * Kept for layout consumers that reserve vertical space.
 */
export const PULSE_STRIP_HEIGHT = 8 /* wrap py */ + 64 /* ring */ + 4 + 14 /* name */ + 8;

/** Horizontal stories strip — primary surface is the Pulse tab. */
export function PulseStrip({ onOpenStory, onCreatePress, canCreate = true }: Props) {
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
          <Pressable
            style={styles.item}
            onPress={onCreatePress}
            accessibilityLabel={canCreate ? 'Create your story' : 'Story posting locked'}
          >
            <View
              style={[
                styles.ring,
                styles.ringCreate,
                !canCreate && styles.ringCreateLocked,
              ]}
            >
              <Text style={[styles.plus, !canCreate && styles.plusLocked]}>
                {canCreate ? '+' : '🔒'}
              </Text>
            </View>
            <Text style={styles.name}>{canCreate ? 'Your story' : 'Locked'}</Text>
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
  ringUnseen: { borderWidth: 2, borderColor: colors.accent },
  ringSeen: { borderWidth: 2, borderColor: colors.textFaint },
  ringCreate: { borderWidth: 2, borderColor: colors.textMuted, borderStyle: 'dashed' },
  ringCreateLocked: { borderColor: colors.textFaint, opacity: 0.7 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceRaised },
  avatarFallback: { justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: colors.textPrimary, fontSize: 20, fontWeight: '600' },
  plus: { color: colors.textPrimary, fontSize: 28, fontWeight: '300' },
  plusLocked: { fontSize: 20 },
  name: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textSecondary,
    maxWidth: 72,
    textAlign: 'center',
  },
  empty: { color: colors.textMuted, fontSize: 13, paddingHorizontal: 8, alignSelf: 'center' },
});
