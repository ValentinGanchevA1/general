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

import type { StoryCard, StoryGateReason } from '@g88/shared';
import { storyGateMessage } from '@g88/shared';

import { useAppSelector } from '@/hooks/redux';

export type StoryGateLockReason = Exclude<StoryGateReason, 'ok'>;

interface Props {
  onOpenStory: (story: StoryCard, index: number) => void;
  onCreatePress: () => void;
  /** When false, create ring is muted; host still receives onCreatePress for CTA. */
  canCreate?: boolean;
  /** Why create is locked — drives ring label + a11y. */
  gateReason?: StoryGateLockReason;
}

/**
 * Rendered height of the strip (padding + ring + name).
 * Kept for layout consumers that reserve vertical space.
 */
export const PULSE_STRIP_HEIGHT = 8 /* wrap py */ + 64 /* ring */ + 4 + 14 /* name */ + 8;

function createRingLabel(canCreate: boolean, reason?: StoryGateLockReason): string {
  if (canCreate) return 'Your story';
  switch (reason) {
    case 'email_unverified':
      return 'Verify';
    case 'account_too_new':
      return 'Soon';
    case 'phone_required':
      return 'Phone';
    case 'suspended':
      return 'Paused';
    default:
      return 'Locked';
  }
}

/** Horizontal stories strip — primary surface is the Pulse tab. */
export function PulseStrip({
  onOpenStory,
  onCreatePress,
  canCreate = true,
  gateReason,
}: Props) {
  const stories = useAppSelector((s) => s.stories.nearby);
  const loading = useAppSelector((s) => s.stories.loading);

  const ringLabel = createRingLabel(canCreate, gateReason);
  const createA11y = canCreate
    ? 'Create your story'
    : gateReason
      ? `Story posting locked: ${storyGateMessage(gateReason)}`
      : 'Story posting locked';

  const renderItem = useCallback(
    ({ item, index }: { item: StoryCard; index: number }) => {
      const unseen = !item.viewedByMe;
      const isVideo = item.mediaType === 'video';
      return (
        <Pressable
          style={styles.item}
          onPress={() => onOpenStory(item, index)}
          accessibilityRole="button"
          accessibilityLabel={`${isVideo ? 'Video story' : 'Story'} by ${item.authorDisplayName}`}
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
            {isVideo ? (
              <View style={styles.videoBadge} pointerEvents="none">
                <Text style={styles.videoBadgeText}>▶</Text>
              </View>
            ) : null}
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
            accessibilityRole="button"
            accessibilityLabel={createA11y}
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
            <Text style={styles.name} numberOfLines={1}>
              {ringLabel}
            </Text>
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
  videoBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadgeText: { color: '#fff', fontSize: 9, marginLeft: 1 },
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
