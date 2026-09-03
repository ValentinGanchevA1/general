import React, { useState } from 'react';
import { useCachedImageUri } from '@/hooks/useCachedImageUri';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

export type AvatarRingVariant = 'none' | 'brand' | 'friend' | 'story' | 'verified';

export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  /** @deprecated Prefer ringVariant="brand". Kept for existing call sites. */
  ring?: boolean;
  /** Visual ring: brand (cyan), friend (green), story (accent), verified (primary strong). */
  ringVariant?: AvatarRingVariant;
  online?: boolean;
  /** Friend marker — short green arc-style ring if ringVariant not set. */
  isFriend?: boolean;
  style?: StyleProp<ViewStyle>;
}

function resolveRingColor(
  ringVariant: AvatarRingVariant | undefined,
  ring: boolean | undefined,
  isFriend: boolean | undefined,
): string | null {
  if (ringVariant && ringVariant !== 'none') {
    switch (ringVariant) {
      case 'brand':
        return colors.primary;
      case 'friend':
        return colors.success;
      case 'story':
        return colors.accent;
      case 'verified':
        return colors.primary;
      default:
        return null;
    }
  }
  if (isFriend) return colors.success;
  if (ring) return colors.primary;
  return null;
}

/**
 * Circular avatar: primary photo when available, initials fallback.
 * Image load errors fall back to initials so a broken CDN URL never blanks the UI.
 * Remote URLs resolve through offline disk cache (file:// when warmed).
 */
export function Avatar({
  uri,
  name,
  size = 72,
  ring = false,
  ringVariant,
  online = false,
  isFriend = false,
  style,
}: AvatarProps): React.JSX.Element {
  const cachedUri = useCachedImageUri(uri);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(cachedUri) && !failed;

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const radius = size / 2;
  const ringColor = resolveRingColor(ringVariant, ring, isFriend);
  const ringWidth = ringColor ? Math.max(2, Math.round(size * 0.04)) : 0;

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
          <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>
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
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    color: colors.primary,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    backgroundColor: colors.success,
    borderColor: colors.bg,
  },
});
