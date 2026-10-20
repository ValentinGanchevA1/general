import React, { useState } from 'react';
import { useCachedImageUri } from '@/hooks/useCachedImageUri';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useAppTheme, type ThemeColors } from '@/theme';

export type AvatarRing = 'none' | 'brand' | 'friend' | 'story' | 'verified';
export type AvatarRingVariant = AvatarRing;

export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  ring?: boolean;
  ringVariant?: AvatarRing;
  isFriend?: boolean;
  online?: boolean;
  style?: StyleProp<ViewStyle>;
}

function resolveRingColor(
  colors: ThemeColors,
  ringVariant: AvatarRing | undefined,
  ring: boolean | undefined,
  isFriend: boolean | undefined,
): string | null {
  if (ringVariant && ringVariant !== 'none') {
    const ringColors: Record<Exclude<AvatarRing, 'none'>, string> = {
      brand: colors.primary,
      friend: colors.entityFriend,
      story: colors.accent,
      verified: colors.accent,
    };
    return ringColors[ringVariant];
  }
  if (isFriend) return colors.entityFriend;
  if (ring) return colors.primary;
  return null;
}

export function Avatar({
  uri,
  name,
  size = 72,
  ring = false,
  ringVariant,
  isFriend = false,
  online = false,
  style,
}: AvatarProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const cachedUri = useCachedImageUri(uri);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(cachedUri) && !failed;

  const ringColor = resolveRingColor(colors, ringVariant, ring, isFriend);
  const hasRing = ringColor != null;
  const ringWidth = hasRing ? Math.max(2, Math.round(size * 0.04)) : 0;

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const radius = size / 2;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: radius,
            borderWidth: ringWidth,
            borderColor: ringColor ?? 'transparent',
            backgroundColor: colors.bg,
          },
        ]}
      >
        {showImage ? (
          <Image
            key={cachedUri ?? 'none'}
            source={{ uri: cachedUri as string }}
            style={{
              width: size - ringWidth * 2,
              height: size - ringWidth * 2,
              borderRadius: radius - ringWidth,
            }}
            onError={() => setFailed(true)}
            accessibilityLabel={`${name} avatar`}
          />
        ) : (
          <Text
            style={[
              styles.initials,
              { fontSize: Math.round(size * 0.36), color: colors.primary },
            ]}
          >
            {initials || '?'}
          </Text>
        )}
      </View>
      {online ? (
        <View
          style={[
            styles.onlineDot,
            {
              width: Math.max(10, size * 0.22),
              height: Math.max(10, size * 0.22),
              borderRadius: Math.max(5, size * 0.11),
              borderWidth: Math.max(2, size * 0.03),
              backgroundColor: colors.success,
              borderColor: colors.bg,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  initials: { fontWeight: '700' },
  onlineDot: { position: 'absolute', bottom: 1, right: 1 },
});
