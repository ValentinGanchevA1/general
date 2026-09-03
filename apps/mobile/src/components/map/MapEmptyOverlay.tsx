import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import type { DiscoveryPoint } from '@g88/shared';
import { EmptyState } from '@/components/ui/EmptyState';
import { colors, radius, spacing } from '@/theme';

interface Props {
  /** True after first discovery response for this viewport. */
  ready: boolean;
  loading: boolean;
  points: DiscoveryPoint[];
  onRefresh: () => void;
  onCreateNearby?: () => void;
}

/**
 * Sparse / empty viewport overlay for MapScreen.
 * Hidden while loading or when any non-cluster points exist.
 */
export function MapEmptyOverlay({
  ready,
  loading,
  points,
  onRefresh,
  onCreateNearby,
}: Props): React.JSX.Element | null {
  const hasEntities = useMemo(
    () => points.some((p) => p.kind !== 'cluster'),
    [points],
  );

  if (!ready || loading || hasEntities) return null;

  return (
    <View style={styles.card} pointerEvents="box-none">
      <EmptyState
        compact
        icon="map-marker-radius-outline"
        title="No one nearby yet"
        body="Pan the map or drop a pin so others can find you. Share presence to light up the area."
        actionLabel="Refresh"
        onAction={onRefresh}
        {...(onCreateNearby
          ? { secondaryLabel: 'Create nearby', onSecondary: onCreateNearby }
          : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: 100,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
});
