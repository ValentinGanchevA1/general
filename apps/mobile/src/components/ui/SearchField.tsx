import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';

export interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  containerStyle?: StyleProp<ViewStyle>;
}

/** Map / list search control — themed, 44dp min height. */
export function SearchField({
  containerStyle,
  placeholder = 'Search…',
  ...rest
}: SearchFieldProps): React.JSX.Element {
  const { colors, radius, fontSize, spacing, layout } = useAppTheme();

  return (
    <View
      style={[
        styles.wrap,
        {
          minHeight: layout.minTouch,
          backgroundColor: colors.surfaceRaised,
          borderRadius: radius.pill,
          borderColor: colors.border,
          paddingHorizontal: spacing.md,
        },
        containerStyle,
      ]}
    >
      <Icon name="magnify" size={20} color={colors.textMuted} accessibilityElementsHidden />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={{
          flex: 1,
          marginLeft: spacing.sm,
          color: colors.textPrimary,
          fontSize: fontSize.md,
          paddingVertical: spacing.sm,
        }}
        accessibilityLabel={rest.accessibilityLabel ?? placeholder}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
