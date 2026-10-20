import React from 'react';
import { StyleSheet, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';

import type { NexaTrustLevel } from './nexaTrustVisuals';

interface NexaTrustMarkProps {
  level: NexaTrustLevel;
  size?: number;
  accessibilityLabel: string;
}

export function NexaTrustMark({
  level,
  size = 88,
  accessibilityLabel,
}: NexaTrustMarkProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const identityVerified = level === 'identity' || level === 'trusted';
  const trusted = level === 'trusted';
  const contactVerified = level === 'contact';
  const tone = identityVerified
    ? colors.verified
    : contactVerified
      ? colors.actionPrimary
      : colors.textTertiary;

  return (
    <View
      style={[styles.stage, { width: size, height: size }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <View
        pointerEvents="none"
        style={[
          styles.outerRing,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: identityVerified ? colors.discoveryBorder : colors.borderDefault,
            backgroundColor: identityVerified ? colors.discoverySoft : colors.surfaceSecondary,
          },
        ]}
      />
      {trusted ? (
        <View
          pointerEvents="none"
          style={[
            styles.trustedRing,
            {
              width: size - 12,
              height: size - 12,
              borderRadius: (size - 12) / 2,
              borderColor: colors.actionBorder,
            },
          ]}
        />
      ) : null}
      <Icon
        name={identityVerified ? 'shield-check' : contactVerified ? 'shield-half-full' : 'shield-outline'}
        size={Math.round(size * 0.46)}
        color={tone}
      />
      {identityVerified ? (
        <View
          pointerEvents="none"
          style={[
            styles.checkBadge,
            {
              width: Math.round(size * 0.25),
              height: Math.round(size * 0.25),
              borderRadius: Math.round(size * 0.125),
              right: Math.round(size * 0.02),
              bottom: Math.round(size * 0.03),
              backgroundColor: colors.surfacePrimary,
              borderColor: colors.verified,
            },
          ]}
        >
          <Icon name="check" size={Math.round(size * 0.14)} color={colors.verified} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  outerRing: {
    position: 'absolute',
    borderWidth: 1.5,
  },
  trustedRing: {
    position: 'absolute',
    borderWidth: 1,
  },
  checkBadge: {
    position: 'absolute',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
