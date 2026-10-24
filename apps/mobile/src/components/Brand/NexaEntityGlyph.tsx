import React from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import {
  resolveNexaEntityIdentity,
  type NexaEntityIdentityKind,
} from '@/product/nexaEntityIdentity';

export type NexaEntityGlyphKind = NexaEntityIdentityKind;

export interface NexaEntityGlyphProps {
  kind: NexaEntityGlyphKind;
  size?: number;
  color: string;
  fillColor?: string;
  strokeWidth?: number;
}

/**
 * Compact renderer for the canonical NEXA entity identity contract.
 * Map markers keep their own state rings/captions; this component renders only
 * the semantic core for filters, rails, headers and similar small UI.
 */
export function NexaEntityGlyph({
  kind,
  size = 18,
  color,
  fillColor = 'transparent',
  strokeWidth = 1.8,
}: NexaEntityGlyphProps): React.JSX.Element {
  const { shape } = resolveNexaEntityIdentity(kind);
  const stage: ViewStyle = {
    width: size,
    height: size,
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (shape === 'star') {
    return (
      <View style={stage} accessible={false} pointerEvents="none">
        <Icon name="star-four-points" size={size} color={color} />
      </View>
    );
  }

  const boundingSize = size * 0.72;
  const shapeSide = shape === 'diamond' ? boundingSize / Math.SQRT2 : boundingSize;

  const shapeStyle: ViewStyle = {
    width: shapeSide,
    height: shapeSide,
    borderWidth: strokeWidth,
    borderColor: color,
    backgroundColor: fillColor,
  };

  if (shape === 'circle') {
    shapeStyle.borderRadius = shapeSide / 2;
  } else if (shape === 'square') {
    shapeStyle.borderRadius = Math.max(2, shapeSide * 0.16);
  } else {
    shapeStyle.borderRadius = Math.max(2, shapeSide * 0.14);
    shapeStyle.transform = [{ rotate: '45deg' }];
  }

  return (
    <View style={stage} accessible={false} pointerEvents="none">
      <View style={[styles.shape, shapeStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  shape: {
    flexShrink: 0,
  },
});
