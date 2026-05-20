import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ClusterPoint } from '@g88/shared';

const KIND_COLOR = {
  user: '#FF69B4',
  event: '#FF9800',
  listing: '#4CAF50',
} as const;

interface Props {
  point: ClusterPoint;
}

export function ClusterMarker({ point }: Props): React.JSX.Element {
  // Pick the dominant kind for the ring color.
  const dominant = (Object.entries(point.by) as [keyof typeof KIND_COLOR, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const ringColor = dominant ? KIND_COLOR[dominant[0]] : '#00d4ff';

  const size = point.count > 100 ? 56 : point.count > 20 ? 48 : 40;

  return (
    <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2, borderColor: ringColor }]}>
      <Text style={[styles.label, { fontSize: point.count > 99 ? 11 : 13 }]}>
        {point.count > 999 ? '999+' : point.count}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    backgroundColor: 'rgba(10,10,15,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { color: '#fff', fontWeight: '700' },
});
