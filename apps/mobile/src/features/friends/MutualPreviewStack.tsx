import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { MutualPreviewFace } from '@g88/shared';

import { Avatar } from '@/components/Avatar';
import { colors } from '@/theme';

type Props = {
  faces: readonly MutualPreviewFace[];
  /** Avatar diameter. Default 22 (list); rail uses 16. */
  size?: number;
  max?: number;
};

/**
 * Overlapping mutual-friend faces for suggestion density.
 * Presentational only — caller supplies server mutualPreview.
 */
export function MutualPreviewStack({
  faces,
  size = 22,
  max = 3,
}: Props): React.JSX.Element | null {
  const slice = faces.slice(0, max);
  if (slice.length === 0) return null;

  const overlap = Math.round(size * 0.36);

  return (
    <View style={styles.row} accessibilityLabel={`${slice.length} mutual friends`}>
      {slice.map((f, i) => (
        <View
          key={f.userId}
          style={[
            styles.face,
            {
              marginLeft: i === 0 ? 0 : -overlap,
              zIndex: max - i,
              borderRadius: size / 2,
              borderColor: colors.surfaceRaised,
            },
          ]}
        >
          <Avatar uri={f.avatarUrl} name={f.displayName} size={size} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  face: {
    borderWidth: 1.5,
    overflow: 'hidden',
  },
});
