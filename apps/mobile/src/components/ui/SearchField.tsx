import React from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';
import { nexusVisual } from '@/theme/nexusVisual';

export interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  containerStyle?: StyleProp<ViewStyle>;
}

export function SearchField({ containerStyle, placeholder = 'Search…', ...rest }: SearchFieldProps): React.JSX.Element {
  const { colors, radius, fontSize, spacing, layout, mode, shadow } = useAppTheme();
  const isNexus = mode === 'protos-nexus';

  return (
    <View
      style={[
        styles.wrap,
        {
          minHeight: layout.minTouch,
          backgroundColor: colors.surfaceRaised,
          borderRadius: isNexus ? nexusVisual.radius.pill : radius.pill,
          borderColor: isNexus ? colors.borderStrong : colors.border,
          borderWidth: isNexus ? nexusVisual.borderWidth : StyleSheet.hairlineWidth,
          paddingHorizontal: spacing.md,
        },
        isNexus ? shadow(0.12) : null,
        containerStyle,
      ]}
    >
      <Icon name="magnify" size={20} color={isNexus ? colors.primary : colors.textMuted} accessibilityElementsHidden />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={{ flex: 1, marginLeft: spacing.sm, color: colors.textPrimary, fontSize: fontSize.md, paddingVertical: spacing.sm }}
        accessibilityLabel={rest.accessibilityLabel ?? placeholder}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
});
