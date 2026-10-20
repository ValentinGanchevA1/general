import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { ClusterPoint, EntityKind } from '@g88/shared';

import { useAppTheme } from '@/theme';

import { diamondSideForBoundingSize } from './nexaEntityMarkerVisuals';
import {
  clusterAccessibilityLabel,
  resolveNexaClusterVisual,
  type NexaClusterMode,
  type NexaClusterShape,
} from './nexaClusterVisuals';
import { clusterVisualKey } from './markerVisualKeys';

interface Props {
  point: ClusterPoint;
  selected?: boolean;
  showComposition?: boolean;
}

const ROOT_SIZE = 68;

function ClusterMarkerImpl({
  point,
  selected = false,
  showComposition = true,
}: Props): React.JSX.Element {
  const { colors } = useAppTheme();
  const visual = resolveNexaClusterVisual(point);
  const semanticColor =
    visual.mode === 'user'
      ? colors.entityPerson
      : visual.mode === 'event'
        ? colors.entityEvent
        : visual.mode === 'listing'
          ? colors.entityListing
          : colors.borderStrong;

  const fillColor =
    visual.mode === 'user'
      ? colors.actionSoft
      : visual.mode === 'event'
        ? colors.discoverySoft
        : visual.mode === 'listing'
          ? colors.surfacePrimary
          : colors.surfaceSecondary;

  const shapeStyle = clusterShapeStyle(
    visual.shape,
    visual.size,
    semanticColor,
    fillColor,
  );
  const showCompositionGlyphs =
    showComposition && visual.showCompositionGlyphs;

  const labelFontSize =
    visual.countLabel.length >= 4
      ? 10
      : visual.size >= 56
        ? 15
        : visual.size >= 48
          ? 14
          : 13;

  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="button"
      accessibilityLabel={clusterAccessibilityLabel(point)}
      accessibilityHint="Zooms in to reveal nearby items"
    >
      {selected ? (
        <View
          pointerEvents="none"
          style={[
            styles.selectedRing,
            {
              borderColor: colors.actionPrimary,
              shadowColor: colors.actionPrimary,
            },
          ]}
        />
      ) : null}

      <View style={styles.shapeStage} pointerEvents="none">
        <View style={[styles.shape, shapeStyle]} />
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.contentStage,
          { width: visual.size, height: visual.size },
        ]}
      >
        <Text
          style={[
            styles.count,
            { color: colors.textPrimary, fontSize: labelFontSize },
            showCompositionGlyphs && styles.mixedCount,
          ]}
        >
          {visual.countLabel}
        </Text>

        {showCompositionGlyphs ? (
          <View style={styles.compositionRow}>
            {visual.composition.activeKinds.map((kind) => (
              <CompositionGlyph
                key={kind}
                kind={kind}
                color={clusterKindColor(kind, colors)}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function clusterKindColor(
  kind: EntityKind,
  colors: ReturnType<typeof useAppTheme>['colors'],
): string {
  if (kind === 'user') return colors.entityPerson;
  if (kind === 'event') return colors.entityEvent;
  return colors.entityListing;
}

function clusterShapeStyle(
  shape: NexaClusterShape,
  size: number,
  borderColor: string,
  backgroundColor: string,
): ViewStyle {
  if (shape === 'diamond') {
    const side = diamondSideForBoundingSize(size);
    return {
      width: side,
      height: side,
      borderRadius: Math.max(5, side * 0.16),
      borderColor,
      backgroundColor,
      transform: [{ rotate: '45deg' }],
    };
  }

  if (shape === 'square') {
    const side = size * 0.88;
    return {
      width: side,
      height: side,
      borderRadius: Math.max(7, side * 0.18),
      borderColor,
      backgroundColor,
    };
  }

  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    borderColor,
    backgroundColor,
  };
}

function CompositionGlyph({
  kind,
  color,
}: {
  kind: EntityKind;
  color: string;
}): React.JSX.Element {
  const style = compositionGlyphStyle(kind, color);
  return <View style={[styles.compositionGlyph, style]} />;
}

function compositionGlyphStyle(kind: EntityKind, color: string): ViewStyle {
  if (kind === 'event') {
    return {
      width: 5.5,
      height: 5.5,
      borderRadius: 1,
      backgroundColor: color,
      transform: [{ rotate: '45deg' }],
    };
  }

  if (kind === 'listing') {
    return {
      width: 6,
      height: 6,
      borderRadius: 1.5,
      backgroundColor: color,
    };
  }

  return {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: color,
  };
}

function clusterMarkerPropsEqual(prev: Props, next: Props): boolean {
  return (
    prev.selected === next.selected &&
    prev.showComposition === next.showComposition &&
    clusterVisualKey(prev.point) === clusterVisualKey(next.point) &&
    prev.point.lat === next.point.lat &&
    prev.point.lng === next.point.lng
  );
}

export const ClusterMarker = React.memo(ClusterMarkerImpl, clusterMarkerPropsEqual);

/**
 * Kept exported for tests / future provider-specific native marker rendering.
 * Mixed clusters are intentionally neutral: composition is shown by micro geometry,
 * not by inventing a fourth entity color.
 */
export function clusterModeLabel(mode: NexaClusterMode): string {
  if (mode === 'user') return 'People';
  if (mode === 'event') return 'Events';
  if (mode === 'listing') return 'Listings';
  return 'Mixed';
}

const styles = StyleSheet.create({
  root: {
    width: ROOT_SIZE,
    height: ROOT_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'visible',
  },
  shapeStage: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shape: {
    position: 'absolute',
    borderWidth: 2.25,
  },
  contentStage: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {
    fontWeight: '800',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  mixedCount: {
    transform: [{ translateY: -3 }],
  },
  compositionRow: {
    position: 'absolute',
    bottom: 7,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  compositionGlyph: {
    opacity: 0.95,
  },
  selectedRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1.5,
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
});
