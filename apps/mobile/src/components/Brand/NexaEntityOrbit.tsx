import React from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';

import { NexaSymbol } from './NexaSymbol';

export interface NexaEntityOrbitProps {
  size?: number;
}

/**
 * Expanded NEXA ecosystem mark for hero-sized brand surfaces.
 *
 * The compact identity remains NexaSymbol. This composition adds the canonical
 * entity vocabulary around it: person (circle), event (star), listing (square)
 * and place/local signal (pin). Keep this out of tiny placements where the
 * orbit would lose legibility.
 */
export function NexaEntityOrbit({ size = 180 }: NexaEntityOrbitProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const height = Math.round(size * 0.64);
  const markerBox = Math.max(24, Math.round(size * 0.16));
  const personSize = Math.max(13, Math.round(size * 0.09));
  const squareSize = Math.max(14, Math.round(size * 0.095));
  const iconSize = Math.max(16, Math.round(size * 0.12));
  const symbolSize = Math.round(size * 0.36);

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.root, { width: size, height }]}
    >
      <View
        style={[
          styles.orbit,
          {
            width: Math.round(size * 0.94),
            height: Math.round(height * 0.62),
            borderColor: colors.discoveryBorder,
            transform: [{ rotate: '-8deg' }],
          },
        ]}
      />
      <View
        style={[
          styles.orbit,
          {
            width: Math.round(size * 0.86),
            height: Math.round(height * 0.43),
            borderColor: colors.actionBorder,
            transform: [{ rotate: '8deg' }],
          },
        ]}
      />

      <View
        style={[
          styles.coreHalo,
          {
            width: Math.round(symbolSize * 1.42),
            height: Math.round(symbolSize * 1.42),
            borderRadius: Math.round(symbolSize * 0.71),
            borderColor: colors.discoveryBorder,
            backgroundColor: colors.discoverySoft,
          },
        ]}
      />
      <NexaSymbol size={symbolSize} />

      <View
        style={[
          styles.markerBox,
          {
            width: markerBox,
            height: markerBox,
            left: Math.round(size * 0.08),
            top: Math.round(height * 0.08),
          },
        ]}
      >
        <View
          style={[
            styles.person,
            {
              width: personSize,
              height: personSize,
              borderRadius: personSize / 2,
              borderColor: colors.entityPerson,
              backgroundColor: colors.actionMutedBg,
            },
          ]}
        />
      </View>

      <View
        style={[
          styles.markerBox,
          {
            width: markerBox,
            height: markerBox,
            right: Math.round(size * 0.05),
            top: Math.round(height * 0.12),
          },
        ]}
      >
        <Icon name="star-four-points" size={iconSize} color={colors.entityEvent} />
      </View>

      <View
        style={[
          styles.markerBox,
          {
            width: markerBox,
            height: markerBox,
            right: Math.round(size * 0.13),
            bottom: Math.round(height * 0.03),
          },
        ]}
      >
        <View
          style={[
            styles.listing,
            {
              width: squareSize,
              height: squareSize,
              borderColor: colors.entityListing,
              backgroundColor: colors.surfaceSecondary,
            },
          ]}
        />
      </View>

      <View
        style={[
          styles.markerBox,
          {
            width: markerBox,
            height: markerBox,
            left: Math.round(size * 0.08),
            bottom: Math.round(height * 0.02),
          },
        ]}
      >
        <Icon name="map-marker-outline" size={iconSize + 2} color={colors.entityOpportunity} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  orbit: {
    position: 'absolute',
    borderWidth: 1,
    borderRadius: 999,
  },
  coreHalo: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
  },
  markerBox: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  person: {
    borderWidth: 2,
  },
  listing: {
    borderWidth: 2,
    borderRadius: 3,
  },
});
