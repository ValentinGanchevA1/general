import React, { useState } from 'react';
import { useCachedImageUri } from '@/hooks/useCachedImageUri';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

export type AvatarRing = 'none' | 'brand' | 'friend' | 'verified';

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
   * Visual ring style:
   * - brand: primary cyan (default when ring=true)
   * - friend: action green
   * - verified: accent purple (ID / high trust)
   * - none: no ring
   */
  ringVariant?: AvatarRing;
  online?: boolean;
  style?: StyleProp<ViewStyle>;
}

const RING_COLOR: Record<Exclude<AvatarRing, 'none'>, string> = {
  brand: colors.primary,
  friend: colors.action,
  verified: colors.accent,
};

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
  style,
}: AvatarProps): React.JSX.Element {
  const cachedUri = useCachedImageUri(uri);
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(cachedUri) && !failed;

  const resolvedRing: AvatarRing =
    ringVariant ?? (ring ? 'brand' : 'none');
  const hasRing = resolvedRing !== 'none';
  const ringColor = hasRing ? RING_COLOR[resolvedRing] : 'transparent';

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const radius = size / 2;
  const ringWidth = hasRing ? Math.max(2, Math.round(size * 0.04)) : 0;

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
            borderColor: ringColor,
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
