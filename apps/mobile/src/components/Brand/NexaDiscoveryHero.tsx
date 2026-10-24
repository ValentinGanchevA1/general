import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { NexaEntityOrbit } from './NexaEntityOrbit';

interface NexaDiscoveryHeroProps {
  compact?: boolean;
}

/**
 * Decorative map-first brand motif for auth/onboarding surfaces.
 * Uses the final NEXA ecosystem vocabulary without exposing real location data.
 */
export function NexaDiscoveryHero({
  compact = false,
}: NexaDiscoveryHeroProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const height = compact ? 112 : 156;
  const orbitSize = compact ? 150 : 205;

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
      <View
        style={[
          styles.gridHorizontal,
          styles.gridHorizontalTop,
          { backgroundColor: colors.borderSubtle },
        ]}
      />
      <View
        style={[
          styles.gridHorizontal,
          styles.gridHorizontalBottom,
          { backgroundColor: colors.borderSubtle },
        ]}
      />
      <View
        style={[
          styles.gridVertical,
          styles.gridVerticalLeft,
          { backgroundColor: colors.borderSubtle },
        ]}
      />
      <View
        style={[
          styles.gridVertical,
          styles.gridVerticalRight,
          { backgroundColor: colors.borderSubtle },
        ]}
      />

      <NexaEntityOrbit size={orbitSize} />
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
});
