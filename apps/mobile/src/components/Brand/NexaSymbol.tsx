import React from 'react';
import { StyleSheet, View } from 'react-native';

import { nexaBrand, nexaDark } from '@/theme';

export interface NexaSymbolProps {
  size?: number;
}

/**
 * Final NEXA eye / discovery core.
 *
 * The upper lid is intentionally shallow rather than a full semicircle, the
 * iris and luminous pupil share one optical center, and a restrained lower lid
 * closes the silhouette just enough to read as an eye without turning the mark
 * into a literal illustration. The splash can surround this core with the NEXA
 * entity orbit without changing the reusable brand primitive.
 */
export function NexaSymbol({ size = 96 }: NexaSymbolProps): React.JSX.Element {
  const lidWidth = size * 0.9;
  const lidHeight = size * 0.48;
  const lidStroke = Math.max(4, size * 0.058);
  const lidTop = size * 0.13;
  const lidClipHeight = size * 0.31;

  const opticalCenterY = size * 0.54;
  const irisSize = size * 0.43;
  const irisTop = opticalCenterY - irisSize / 2;
  const dotSize = size * 0.22;
  const dotTop = opticalCenterY - dotSize / 2;

  const lowerLidWidth = size * 0.31;
  const lowerLidStroke = Math.max(2, size * 0.022);
  const lowerLidTop = size * 0.7;
  const lowerLidInset = size * 0.2;

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
            width: irisSize * 1.18,
            height: irisSize * 1.18,
            borderRadius: (irisSize * 1.18) / 2,
            left: (size - irisSize * 1.18) / 2,
            top: opticalCenterY - (irisSize * 1.18) / 2,
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
          styles.lidClip,
          {
            width: lidWidth,
            height: lidClipHeight,
            left: (size - lidWidth) / 2,
            top: lidTop,
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.lidGlowOuter,
            {
              width: lidWidth,
              height: lidHeight,
              borderRadius: 999,
              borderWidth: lidStroke * 1.85,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.lidGlowInner,
            {
              width: lidWidth,
              height: lidHeight,
              borderRadius: 999,
              borderWidth: lidStroke * 1.3,
            },
          ]}
        />
        <View
          style={[
            styles.lid,
            {
              width: lidWidth,
              height: lidHeight,
              borderRadius: 999,
              borderWidth: lidStroke,
            },
          ]}
        />
      </View>

      <View
        pointerEvents="none"
        style={[
          styles.lowerLidGlow,
          {
            width: lowerLidWidth,
            height: lowerLidStroke * 2.4,
            left: lowerLidInset,
            top: lowerLidTop,
            borderRadius: lowerLidStroke * 1.2,
            transform: [{ rotateZ: '10deg' }],
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.lowerLidGlow,
          {
            width: lowerLidWidth,
            height: lowerLidStroke * 2.4,
            right: lowerLidInset,
            top: lowerLidTop,
            borderRadius: lowerLidStroke * 1.2,
            transform: [{ rotateZ: '-10deg' }],
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.lowerLid,
          {
            width: lowerLidWidth,
            height: lowerLidStroke,
            left: lowerLidInset,
            top: lowerLidTop,
            borderRadius: lowerLidStroke / 2,
            transform: [{ rotateZ: '10deg' }],
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.lowerLid,
          {
            width: lowerLidWidth,
            height: lowerLidStroke,
            right: lowerLidInset,
            top: lowerLidTop,
            borderRadius: lowerLidStroke / 2,
            transform: [{ rotateZ: '-10deg' }],
          },
        ]}
      />

      <View
        pointerEvents="none"
        style={[
          styles.dotHaloOuter,
          {
            width: dotSize * 2.05,
            height: dotSize * 2.05,
            borderRadius: dotSize * 1.025,
            left: (size - dotSize * 2.05) / 2,
            top: opticalCenterY - (dotSize * 2.05) / 2,
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.dotHaloInner,
          {
            width: dotSize * 1.5,
            height: dotSize * 1.5,
            borderRadius: dotSize * 0.75,
            left: (size - dotSize * 1.5) / 2,
            top: opticalCenterY - (dotSize * 1.5) / 2,
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
  lidClip: {
    position: 'absolute',
    overflow: 'hidden',
  },
  lidGlowOuter: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: 'rgba(124, 92, 252, 0.14)',
  },
  lidGlowInner: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: 'rgba(98, 230, 255, 0.18)',
  },
  lid: {
    position: 'absolute',
    top: 0,
    left: 0,
    borderColor: nexaDark.textPrimary,
  },
  lowerLidGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(124, 92, 252, 0.18)',
  },
  lowerLid: {
    position: 'absolute',
    backgroundColor: 'rgba(200, 190, 255, 0.72)',
    shadowColor: nexaBrand.violetBright,
    shadowOpacity: 0.42,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
  },
  irisGlow: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(124, 92, 252, 0.2)',
  },
  iris: {
    position: 'absolute',
    borderColor: 'rgba(200, 190, 255, 0.72)',
    backgroundColor: 'rgba(8, 9, 13, 0.48)',
  },
  dotHaloOuter: {
    position: 'absolute',
    backgroundColor: 'rgba(124, 92, 252, 0.11)',
  },
  dotHaloInner: {
    position: 'absolute',
    backgroundColor: 'rgba(200, 190, 255, 0.16)',
  },
  dot: {
    position: 'absolute',
    backgroundColor: nexaBrand.symbolCore,
    borderWidth: 1,
    borderColor: 'rgba(247, 248, 250, 0.84)',
    shadowColor: nexaBrand.violetBright,
    shadowOpacity: 0.98,
    shadowOffset: { width: 0, height: 0 },
    elevation: 16,
  },
});
