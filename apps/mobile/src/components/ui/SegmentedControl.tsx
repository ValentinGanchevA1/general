import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useAppTheme } from '@/theme';

export interface SegmentedControlProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
}

/** Themed segmented control (All / Unread / Priority, etc.). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  style,
}: SegmentedControlProps<T>): React.JSX.Element {
  const { colors, radius, fontSize, spacing } = useAppTheme();

  return (
    <View
      style={[
        styles.track,
        {
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.md,
          padding: spacing.xs,
          borderColor: colors.border,
        },
        style,
      ]}
      accessibilityRole="tablist"
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={opt.label}
            style={[
              styles.seg,
              {
                borderRadius: radius.sm,
                backgroundColor: selected ? colors.primaryMutedBg : 'transparent',
                borderWidth: selected ? 1 : 0,
                borderColor: selected ? colors.primaryBorder : 'transparent',
              },
            ]}
          >
            <Text
              style={{
                color: selected ? colors.primary : colors.textMuted,
                fontSize: fontSize.sm,
                fontWeight: selected ? '700' : '500',
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
  },
  seg: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
});
