import React from 'react';
import { StyleSheet, View } from 'react-native';

import { nexaBrand, nexaDark } from '@/theme';

export interface NexaSymbolProps {
  size?: number;
}

/**
 * NEXA v2 discovery symbol: horizon/portal arc + focal point.
 * Deliberately avoids an antenna stem so the mark reads as discovery,
 * not broadcast/telecom.
 */
export function NexaSymbol({ size = 96 }: NexaSymbolProps): React.JSX.Element {
  const arcWidth = size * 0.84;
  const arcStroke = Math.max(5, size * 0.075);
  const arcTop = size * 0.14;
  const arcClipHeight = arcWidth / 2;
  const dotSize = size * 0.24;
  const dotTop = arcTop + arcClipHeight + size * 0.045;

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="NEXA"
    >
      <View
        style={[
          styles.arcClip,
          {
            width: arcWidth,
            height: arcClipHeight,
            left: (size - arcWidth) / 2,
            top: arcTop,
          },
        ]}
      >
        <View
          style={[
            styles.arc,
            {
              width: arcWidth,
              height: arcWidth,
              borderRadius: arcWidth / 2,
              borderWidth: arcStroke,
            },
          ]}
        />
      </View>

      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            left: (size - dotSize) / 2,
            top: dotTop,
            shadowRadius: size * 0.14,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
  },
  arcClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  arc: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: nexaDark.textPrimary,
  },
  dot: {
    position: 'absolute',
    backgroundColor: nexaBrand.symbolCore,
    shadowColor: nexaBrand.violet,
    shadowOpacity: 0.95,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
});
