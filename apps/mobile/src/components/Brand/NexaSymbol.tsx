import React from 'react';
import { StyleSheet, View } from 'react-native';

import { nexaBrand, nexaDark } from '@/theme';

export interface NexaSymbolProps {
  size?: number;
}

/**
 * Final NEXA eye / discovery core.
 *
 * The upper horizon remains the primary silhouette, while the iris ring and
 * luminous focal point make the mark read as an eye rather than an antenna or
 * broadcast glyph. The splash can surround this core with the NEXA entity
 * orbit without changing the reusable brand primitive.
 */
export function NexaSymbol({ size = 96 }: NexaSymbolProps): React.JSX.Element {
  const arcWidth = size * 0.86;
  const arcStroke = Math.max(5, size * 0.07);
  const arcTop = size * 0.09;
  const arcClipHeight = arcWidth / 2;

  const irisSize = size * 0.48;
  const irisTop = size * 0.39;
  const dotSize = size * 0.265;
  const dotTop = size * 0.535;

  return (
    <View
      style={[styles.root, { width: size, height: size }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="NEXA"
    >
      <View
        pointerEvents="none"
        style={[
          styles.irisGlow,
          {
            width: irisSize * 1.14,
            height: irisSize * 1.14,
            borderRadius: (irisSize * 1.14) / 2,
            left: (size - irisSize * 1.14) / 2,
            top: irisTop - irisSize * 0.07,
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.iris,
          {
            width: irisSize,
            height: irisSize,
            borderRadius: irisSize / 2,
            left: (size - irisSize) / 2,
            top: irisTop,
            borderWidth: Math.max(1, size * 0.012),
          },
        ]}
      />

      <View
        style={[
          styles.arcClip,
          {
            width: arcWidth,
            height: arcClipHeight + arcStroke,
            left: (size - arcWidth) / 2,
            top: arcTop,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.arcGlowOuter,
            {
              width: arcWidth,
              height: arcWidth,
              borderRadius: arcWidth / 2,
              borderWidth: arcStroke * 1.9,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.arcGlowInner,
            {
              width: arcWidth,
              height: arcWidth,
              borderRadius: arcWidth / 2,
              borderWidth: arcStroke * 1.35,
            },
          ]}
        />
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
        pointerEvents="none"
        style={[
          styles.dotHaloOuter,
          {
            width: dotSize * 2.05,
            height: dotSize * 2.05,
            borderRadius: dotSize * 1.025,
            left: (size - dotSize * 2.05) / 2,
            top: dotTop - dotSize * 0.525,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.dotHaloInner,
          {
            width: dotSize * 1.48,
            height: dotSize * 1.48,
            borderRadius: dotSize * 0.74,
            left: (size - dotSize * 1.48) / 2,
            top: dotTop - dotSize * 0.24,
          },
        ]}
      />
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            left: (size - dotSize) / 2,
            top: dotTop,
            shadowRadius: size * 0.15,
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
  arcGlowOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: 'rgba(124, 92, 252, 0.14)',
  },
  arcGlowInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: 'rgba(98, 230, 255, 0.18)',
  },
  arc: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: nexaDark.textPrimary,
  },
  irisGlow: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.18)',
  },
  iris: {
    position: 'absolute',
    borderColor: 'rgba(200, 190, 255, 0.68)',
    backgroundColor: 'rgba(8, 9, 13, 0.52)',
  },
  dotHaloOuter: {
    position: 'absolute',
    backgroundColor: 'rgba(124, 92, 252, 0.10)',
  },
  dotHaloInner: {
    position: 'absolute',
    backgroundColor: 'rgba(200, 190, 255, 0.14)',
  },
  dot: {
    position: 'absolute',
    backgroundColor: nexaBrand.symbolCore,
    borderWidth: 1,
    borderColor: 'rgba(247, 248, 250, 0.78)',
    shadowColor: nexaBrand.violetBright,
    shadowOpacity: 0.98,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
});
