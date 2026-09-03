import React, { useState } from 'react';
import { useCachedImageUri } from '@/hooks/useCachedImageUri';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

/**
 * Ring styles for map sheet, profile, stories, and markers.
 * - brand: primary cyan
 * - friend: action green
 * - story: accent (stories strip / ring)
 * - verified: accent for ID trust
 * - none: no ring
 */
export type AvatarRing = 'none' | 'brand' | 'friend' | 'story' | 'verified';

/** @deprecated Use AvatarRing — kept for branches that imported AvatarRingVariant. */
export type AvatarRingVariant = AvatarRing;

export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  /**
   * Cyan ring used on profile cards / map sheet.
   * Prefer `ringVariant` for new call sites; `ring` kept for backward compat.
   */
  ring?: boolean;
  /**
   * Visual ring style. See AvatarRing.
   */
  ringVariant?: AvatarRing;
  /** Friend marker — green ring when ringVariant is unset. */
  isFriend?: boolean;
  online?: boolean;
  style?: StyleProp<ViewStyle>;
}

const RING_COLOR: Record<Exclude<AvatarRing, 'none'>, string> = {
  brand: colors.primary,
  friend: colors.action,
  story: colors.accent,
  verified: colors.accent,
};

function resolveRingColor(
  ringVariant: AvatarRing | undefined,
  ring: boolean | undefined,
  isFriend: boolean | undefined,
): string | null {
  if (ringVariant && ringVariant !== 'none') {
    return RING_COLOR[ringVariant];
  }
  if (isFriend) return colors.action;
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
  isFriend = false,
  online = false,
  style,
}: AvatarProps): React.JSX.Element {
  const cachedUri = useCachedImageUri(uri);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(cachedUri) && !failed;

  const ringColor = resolveRingColor(ringVariant, ring, isFriend);
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
  circle: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
  },
});
