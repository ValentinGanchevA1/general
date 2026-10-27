import React from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useAppTheme } from '@/theme';

import { NexaEntityOrbit } from './NexaEntityOrbit';

interface NexaDiscoveryHeroProps {
  compact?: boolean;
}

/**
 * Branded discovery hero for auth/onboarding surfaces.
 *
 * Keeps the NEXA identity, ecosystem orbit and motto in one responsive lockup
 * so onboarding never renders a duplicated symbol/wordmark above the hero.
 */
export function NexaDiscoveryHero({
  compact = false,
}: NexaDiscoveryHeroProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const availableWidth = Math.max(240, width - (compact ? 40 : 56));
  const heroWidth = Math.min(420, availableWidth);
  const orbitSize = Math.round(
    Math.min(compact ? 170 : 320, heroWidth * (compact ? 0.72 : 0.92)),
  );
  const haloSize = Math.round(orbitSize * 0.72);

  return (
    <View
      pointerEvents="none"
      accessible
      accessibilityRole="image"
      accessibilityLabel="NEXA. Your local world."
      style={[styles.root, compact ? styles.compactRoot : styles.defaultRoot]}
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.visual}
      >
        <View
          style={[
            styles.haloOuter,
            {
              width: haloSize,
              height: haloSize,
              borderRadius: haloSize / 2,
              backgroundColor: colors.actionSoft,
            },
          ]}
        />
        <View
          style={[
            styles.haloInner,
            {
              width: Math.round(haloSize * 0.62),
              height: Math.round(haloSize * 0.62),
              borderRadius: Math.round(haloSize * 0.31),
              backgroundColor: colors.discoverySoft,
              borderColor: colors.discoveryBorder,
            },
          ]}
        />
        <NexaEntityOrbit size={orbitSize} />
      </View>

      <Text
        accessibilityElementsHidden
        style={[
          styles.wordmark,
          compact ? styles.wordmarkCompact : styles.wordmarkDefault,
          { color: colors.textPrimary },
        ]}
      >
        NEXA
      </Text>
      <Text
        accessibilityElementsHidden
        style={[
          styles.motto,
          compact ? styles.mottoCompact : styles.mottoDefault,
          { color: colors.discovery },
        ]}
      >
        YOUR LOCAL WORLD
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  defaultRoot: {
    minHeight: 286,
  },
  compactRoot: {
    minHeight: 190,
  },
  visual: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  haloOuter: {
    position: 'absolute',
    opacity: 0.38,
  },
  haloInner: {
    position: 'absolute',
    opacity: 0.42,
    borderWidth: StyleSheet.hairlineWidth,
  },
  wordmark: {
    textAlign: 'center',
    fontWeight: '500',
  },
  wordmarkDefault: {
    marginTop: -8,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: 11,
    paddingLeft: 11,
  },
  wordmarkCompact: {
    marginTop: -4,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 8,
    paddingLeft: 8,
  },
  motto: {
    textAlign: 'center',
    fontWeight: '700',
  },
  mottoDefault: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 3.1,
  },
  mottoCompact: {
    marginTop: 5,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 2.4,
  },
});
