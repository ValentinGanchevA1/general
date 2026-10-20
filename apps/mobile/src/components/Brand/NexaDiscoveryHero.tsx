import React from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';

import { NexaSymbol } from './NexaSymbol';

interface NexaDiscoveryHeroProps {
  compact?: boolean;
}

/**
 * Decorative map-first brand motif for auth/onboarding surfaces.
 * Uses the same semantic geometry as discovery without exposing real location data.
 */
export function NexaDiscoveryHero({
  compact = false,
}: NexaDiscoveryHeroProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const height = compact ? 112 : 156;
  const discoveryRingSize = compact ? 78 : 108;
  const actionRingSize = compact ? 48 : 66;
  const symbolSize = compact ? 34 : 44;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.root,
        {
          height,
          backgroundColor: colors.mapBase,
          borderColor: colors.borderDefault,
        },
      ]}
    >
      <View style={[styles.gridHorizontal, styles.gridHorizontalTop, { backgroundColor: colors.borderSubtle }]} />
      <View style={[styles.gridHorizontal, styles.gridHorizontalBottom, { backgroundColor: colors.borderSubtle }]} />
      <View style={[styles.gridVertical, styles.gridVerticalLeft, { backgroundColor: colors.borderSubtle }]} />
      <View style={[styles.gridVertical, styles.gridVerticalRight, { backgroundColor: colors.borderSubtle }]} />

      <View
        style={[
          styles.ring,
          {
            width: discoveryRingSize,
            height: discoveryRingSize,
            borderRadius: discoveryRingSize / 2,
            borderColor: colors.discoveryBorder,
            backgroundColor: colors.discoverySoft,
          },
        ]}
      />
      <View
        style={[
          styles.ring,
          {
            width: actionRingSize,
            height: actionRingSize,
            borderRadius: actionRingSize / 2,
            borderColor: colors.actionBorder,
            backgroundColor: colors.actionSoft,
          },
        ]}
      />

      <View style={styles.symbolWrap}>
        <NexaSymbol size={symbolSize} />
      </View>

      <View
        style={[
          styles.personMarker,
          compact ? styles.personMarkerCompact : null,
          { borderColor: colors.entityPerson, backgroundColor: colors.actionMutedBg },
        ]}
      />
      <View
        style={[
          styles.eventMarker,
          compact ? styles.eventMarkerCompact : null,
          { borderColor: colors.entityEvent, backgroundColor: colors.discoveryMutedBg },
        ]}
      />
      <View
        style={[
          styles.listingMarker,
          compact ? styles.listingMarkerCompact : null,
          { borderColor: colors.entityListing, backgroundColor: colors.surfaceSecondary },
        ]}
      />
      <View style={[styles.opportunityMarker, compact ? styles.opportunityMarkerCompact : null]}>
        <Icon name="star-four-points" size={compact ? 16 : 20} color={colors.entityOpportunity} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 28,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  gridHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  gridHorizontalTop: { top: '34%' },
  gridHorizontalBottom: { top: '68%' },
  gridVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
  },
  gridVerticalLeft: { left: '32%' },
  gridVerticalRight: { left: '68%' },
  ring: {
    position: 'absolute',
    borderWidth: 1,
  },
  symbolWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  personMarker: {
    position: 'absolute',
    top: 22,
    left: 32,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
  },
  personMarkerCompact: {
    top: 16,
    left: 24,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  eventMarker: {
    position: 'absolute',
    top: 30,
    right: 38,
    width: 17,
    height: 17,
    borderRadius: 3,
    borderWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  eventMarkerCompact: {
    top: 20,
    right: 28,
    width: 14,
    height: 14,
  },
  listingMarker: {
    position: 'absolute',
    bottom: 28,
    left: 58,
    width: 16,
    height: 16,
    borderRadius: 3,
    borderWidth: 2,
  },
  listingMarkerCompact: {
    bottom: 18,
    left: 46,
    width: 13,
    height: 13,
  },
  opportunityMarker: {
    position: 'absolute',
    right: 58,
    bottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opportunityMarkerCompact: {
    right: 44,
    bottom: 16,
  },
});
