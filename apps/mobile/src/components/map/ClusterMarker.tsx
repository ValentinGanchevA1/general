import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ClusterPoint, EntityKind } from '@g88/shared';

import { colors } from '@/theme';

import { clusterVisualKey } from './markerVisualKeys';

const KIND_COLOR: Record<EntityKind, string> = {
  user: colors.entityUser,
  event: colors.entityEvent,
  listing: colors.entityListing,
};

interface Props {
  point: ClusterPoint;
}

function ClusterMarkerImpl({ point }: Props): React.JSX.Element {
  // Pick the dominant kind for the ring color.
  const dominant = (Object.entries(point.by) as [EntityKind, number][]).sort(
    (a, b) => b[1] - a[1],
  )[0];
  const ringColor = dominant ? KIND_COLOR[dominant[0]] : colors.primary;

  const size = point.count > 100 ? 56 : point.count > 20 ? 48 : 40;

  return (
    <View
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, borderColor: ringColor },
      ]}
    >
      <Text style={[styles.label, { fontSize: point.count > 99 ? 11 : 13 }]}>
        {point.count > 999 ? '999+' : point.count}
      </Text>
    </View>
  );
}

function clusterMarkerPropsEqual(prev: Props, next: Props): boolean {
  return (
    clusterVisualKey(prev.point) === clusterVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng
  );
}

export const ClusterMarker = React.memo(ClusterMarkerImpl, clusterMarkerPropsEqual);

const styles = StyleSheet.create({
  ring: {
    borderWidth: 2,
    backgroundColor: 'rgba(10,10,15,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { color: colors.textPrimary, fontWeight: '700' },
});
