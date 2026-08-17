import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
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

interface Props {
  point: EntityPoint;
}

function EntityMarkerImpl({ point }: Props): React.JSX.Element {
  const isFriend = point.kind === 'user' && point.meta.isFriend === true;
  const color = isFriend ? FRIEND_COLOR : KIND_COLOR[point.kind];

  const label =
    point.kind === 'user'
      ? point.meta.displayName.slice(0, 8)
      : point.meta.title.slice(0, 10);

  const isVerified =
    point.kind === 'user' &&
    (point.meta.verifiedBadge === true || point.meta.verification === 'id');

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bubble, { borderColor: color }, isFriend && styles.friendBubble]}>
        <Text style={styles.icon}>{KIND_ICON[point.kind]}</Text>
        {isVerified && (
          <View style={styles.verifiedBadge}>
            <Icon name="check-decagram" size={12} color="#00d4ff" />
          </View>
        )}
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
    prev.point.lng === next.point.lng
  );
}

export const EntityMarker = React.memo(EntityMarkerImpl, entityMarkerPropsEqual);

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: 2 },
  bubble: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: 'rgba(10,10,15,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  friendBubble: {
    borderWidth: 3,
    backgroundColor: 'rgba(0,212,255,0.12)',
  },
  icon: { fontSize: 16 },
  label: { fontSize: 10, fontWeight: '600', maxWidth: 60 },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: 'rgba(10,10,15,0.9)',
    borderRadius: 8,
    padding: 1,
  },
});
