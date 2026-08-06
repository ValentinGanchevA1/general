import React, { useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

export interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  /** Cyan ring used on profile cards / map sheet. */
  ring?: boolean;
  online?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Circular avatar: primary photo when available, initials fallback.
 * Image load errors fall back to initials so a broken CDN URL never blanks the UI.
 */
export function Avatar({
  uri,
  name,
  size = 72,
  ring = false,
  online = false,
  style,
}: AvatarProps): React.JSX.Element {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(uri) && !failed;

  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const radius = size / 2;
  const ringWidth = ring ? Math.max(2, Math.round(size * 0.04)) : 0;

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
            borderColor: ring ? '#00d4ff' : 'transparent',
            backgroundColor: showImage ? '#0a0a1a' : '#0a0a1a',
          },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: uri as string }}
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
    color: '#00d4ff',
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    backgroundColor: '#4caf50',
    borderColor: '#0a0a0f',
  },
});
