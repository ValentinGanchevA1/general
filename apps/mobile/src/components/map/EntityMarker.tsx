import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { EntityPoint } from '@g88/shared';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { entityVisualKey } from './markerVisualKeys';

const KIND_COLOR: Record<EntityPoint['kind'], string> = {
  user: '#FF69B4',
  event: '#FF9800',
  listing: '#4CAF50',
};

/** Close-friend pin — brand cyan so trusted people read above strangers. */
const FRIEND_COLOR = '#00d4ff';

const KIND_ICON: Record<EntityPoint['kind'], string> = {
  user: '👤',
  event: '📅',
  listing: '🛍',
};

const MARKER_SIZE = 40;

interface Props {
  point: EntityPoint;
  /** Fired once avatar image finishes loading or fails — parent can stop tracksViewChanges. */
  onVisualSettled?: () => void;
}

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function EntityMarkerImpl({ point, onVisualSettled }: Props): React.JSX.Element {
  const isFriend = point.kind === 'user' && point.meta.isFriend === true;
  const color = isFriend ? FRIEND_COLOR : KIND_COLOR[point.kind];

  const label =
    point.kind === 'user'
      ? point.meta.displayName.slice(0, 8)
      : point.meta.title.slice(0, 10);

  const isVerified =
    point.kind === 'user' &&
    (point.meta.verifiedBadge === true || point.meta.verification === 'id');

  const avatarUrl = point.kind === 'user' ? point.meta.avatarUrl : null;
  const [imgFailed, setImgFailed] = useState(false);
  const showPhoto = Boolean(avatarUrl) && !imgFailed;

  const settle = (): void => {
    onVisualSettled?.();
  };

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bubble, { borderColor: color }, isFriend && styles.friendBubble]}>
        {point.kind === 'user' && showPhoto ? (
          <Image
            source={{ uri: avatarUrl as string }}
            style={styles.photo}
            onLoad={settle}
            onError={() => {
              setImgFailed(true);
              settle();
            }}
            accessibilityLabel={`${point.meta.displayName} avatar`}
          />
        ) : point.kind === 'user' ? (
          <Text style={[styles.initials, { color }]} onLayout={settle}>
            {initialsFromName(point.meta.displayName) || '?'}
          </Text>
        ) : point.kind === 'event' && point.meta.coverUrl ? (
          <Image
            source={{ uri: point.meta.coverUrl }}
            style={styles.photo}
            onLoad={settle}
            onError={settle}
          />
        ) : point.kind === 'listing' && point.meta.thumbnailUrl ? (
          <Image
            source={{ uri: point.meta.thumbnailUrl }}
            style={styles.photo}
            onLoad={settle}
            onError={settle}
          />
        ) : (
          <Text style={styles.icon} onLayout={settle}>
            {KIND_ICON[point.kind]}
          </Text>
        )}
        {isVerified ? (
          <View style={styles.verifiedBadge}>
            <Icon name="check-decagram" size={12} color="#00d4ff" />
          </View>
        ) : null}
      </View>
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function entityMarkerPropsEqual(prev: Props, next: Props): boolean {
  return (
    entityVisualKey(prev.point) === entityVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng &&
    prev.onVisualSettled === next.onVisualSettled
  );
}

export const EntityMarker = React.memo(EntityMarkerImpl, entityMarkerPropsEqual);

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 2 },
  bubble: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 2.5,
    backgroundColor: 'rgba(10,10,15,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendBubble: {
    borderWidth: 3,
    backgroundColor: 'rgba(0,212,255,0.12)',
  },
  photo: {
    width: MARKER_SIZE - 5,
    height: MARKER_SIZE - 5,
    borderRadius: (MARKER_SIZE - 5) / 2,
  },
  initials: {
    fontSize: 14,
    fontWeight: '700',
  },
  icon: { fontSize: 16 },
  label: { fontSize: 10, fontWeight: '600', maxWidth: 64 },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderRadius: 8,
    padding: 1,
  },
});
