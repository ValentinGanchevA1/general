import React, { useEffect } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchAuthorStories } from '../storiesSlice';

interface Props {
  userId: string;
  avatarUrl: string | null;
  displayName: string;
  size?: number;
  onPress: () => void;
}

/** Profile avatar ring — purple when user has active unviewed stories. */
export function ProfileStoryRing({
  userId,
  avatarUrl,
  displayName,
  size = 72,
  onPress,
}: Props) {
  const dispatch = useAppDispatch();
  const stories = useAppSelector((s) => s.stories.byAuthor[userId] ?? []);

  useEffect(() => {
    void dispatch(fetchAuthorStories(userId));
  }, [dispatch, userId]);

  const hasStories = stories.length > 0;
  const hasUnseen = stories.some((s) => !s.viewedByMe);
  const ring = size;
  const avatar = size - 8;

  return (
    <Pressable
      onPress={hasStories ? onPress : undefined}
      disabled={!hasStories}
      accessibilityRole="button"
      accessibilityLabel={
        hasStories ? `${displayName} has ${stories.length} stories` : displayName
      }
    >
      <View
        style={[
          styles.ring,
          {
            width: ring,
            height: ring,
            borderRadius: ring / 2,
            borderColor: hasStories ? (hasUnseen ? '#7C5CFF' : '#555') : 'transparent',
          },
        ]}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{ width: avatar, height: avatar, borderRadius: avatar / 2 }}
          />
        ) : (
          <View
            style={[
              styles.fallback,
              { width: avatar, height: avatar, borderRadius: avatar / 2 },
            ]}
          >
            <Text style={styles.initial}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2.5, justifyContent: 'center', alignItems: 'center' },
  fallback: {
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initial: { color: '#fff', fontSize: 22, fontWeight: '600' },
});
