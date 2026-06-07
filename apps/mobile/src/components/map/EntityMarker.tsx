import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { EntityPoint } from '@g88/shared';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const KIND_COLOR: Record<EntityPoint['kind'], string> = {
  user: '#FF69B4',
  event: '#FF9800',
  listing: '#4CAF50',
};

const KIND_ICON: Record<EntityPoint['kind'], string> = {
  user: '👤',
  event: '📅',
  listing: '🛍',
};

interface Props {
  point: EntityPoint;
}

export function EntityMarker({ point }: Props): React.JSX.Element {
  const color = KIND_COLOR[point.kind];

  const label =
    point.kind === 'user'
      ? point.meta.displayName.slice(0, 8)
      : point.meta.title.slice(0, 10);

  const isVerified =
    point.kind === 'user' &&
    (point.meta.verifiedBadge === true || point.meta.verification === 'id');

  return (
    <View style={styles.wrapper}>
      <View style={[styles.bubble, { borderColor: color }]}>
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
