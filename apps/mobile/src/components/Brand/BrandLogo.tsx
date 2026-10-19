import React from 'react';
import { Image, StyleSheet, type ImageStyle, type StyleProp } from 'react-native';

type BrandLogoProps = {
  size?: number;
  style?: StyleProp<ImageStyle>;
};

/**
 * Canonical G88 mark (antenna / signal). Use for splash, Auth, and marketing surfaces.
 * Asset: src/assets/logo.png (opaque dark field matching launcher).
 */
export function BrandLogo({ size = 96, style }: BrandLogoProps): React.JSX.Element {
  return (
    <Image
      source={require('../../assets/logo.png')}
      style={[styles.base, { width: size, height: size, borderRadius: size * 0.22 }, style]}
      accessibilityRole="image"
      accessibilityLabel="G88"
      resizeMode="contain"
    />
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'center',
  },
});
