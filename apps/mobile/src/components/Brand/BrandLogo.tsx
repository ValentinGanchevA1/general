// apps/mobile/src/components/Brand/BrandLogo.tsx
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { nexaDark } from '@/theme';

import { NexaSymbol } from './NexaSymbol';

type BrandLogoProps = {
  size?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * Compatibility wrapper for the canonical NEXA brand lockup.
 * Existing screens can keep importing BrandLogo while all visible G88 artwork
 * is removed from the active UI. New brand surfaces should prefer NexaSymbol
 * (and the dedicated NEXA brand components introduced by the v2 design system).
 */
export function BrandLogo({ size = 96, style }: BrandLogoProps): React.JSX.Element {
  const wordmarkSize = Math.max(16, Math.round(size * 0.27));

  return (
    <View
      style={[styles.base, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="NEXA"
    >
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <NexaSymbol size={size} />
      </View>
      <Text
        style={[
          styles.wordmark,
          {
            fontSize: wordmarkSize,
            lineHeight: Math.round(wordmarkSize * 1.25),
            letterSpacing: Math.max(4, Math.round(size * 0.075)),
          },
        ]}
        accessibilityElementsHidden
      >
        NEXA
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    marginTop: -2,
    color: nexaDark.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
});
