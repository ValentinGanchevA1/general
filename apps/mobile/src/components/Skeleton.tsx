import React, { useEffect, useMemo } from 'react';
import {
  Animated,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { radius, spacing, useAppTheme } from '@/theme';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  /** Border radius. Default radius.md. */
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}

/** Shimmer block that resolves its surface token from the active app theme. */
export function Skeleton({
  width = '100%',
  height = 16,
  borderRadius = radius.md,
  style,
}: SkeletonProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const opacity = useMemo(() => new Animated.Value(0.35), []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.75,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.35,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.base,
        { backgroundColor: colors.surfaceRaised, width, height, borderRadius, opacity },
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

/** Compact chat / friend row placeholder. */
export function SkeletonListRow(): React.JSX.Element {
  return (
    <View style={styles.row}>
      <Skeleton width={48} height={48} borderRadius={24} />
      <View style={styles.rowText}>
        <Skeleton width="55%" height={14} />
        <Skeleton width="35%" height={12} style={{ marginTop: spacing.sm }} />
      </View>
    </View>
  );
}

/** Marketplace 2-column card placeholders. */
export function SkeletonMarketGrid({ count = 4 }: { count?: number }): React.JSX.Element {
  const { colors } = useAppTheme();
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <View style={styles.grid}>
      {items.map((i) => (
        <View
          key={i}
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Skeleton width="100%" height={120} borderRadius={0} />
          <View style={styles.cardBody}>
            <Skeleton width="80%" height={12} />
            <Skeleton width="40%" height={14} style={{ marginTop: spacing.sm }} />
            <Skeleton width="50%" height={10} style={{ marginTop: spacing.sm }} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  rowText: { flex: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.md,
  },
  card: {
    width: '47%',
    flexGrow: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardBody: { padding: spacing.sm },
});
