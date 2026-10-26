import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { fontSize, radius, spacing, useAppTheme } from '@/theme';

export interface FormFieldProps extends TextInputProps {
  error?: string | undefined;
  label?: string | undefined;
  leadingAccessory?: React.ReactNode;
  trailingAccessory?: React.ReactNode;
}

/** TextInput + optional label + inline error using the active NEXA theme. */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { error, label, style, leadingAccessory, trailingAccessory, ...rest },
  ref,
) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <View
        style={[
          styles.control,
          {
            backgroundColor: colors.surfaceSecondary,
            borderColor: error ? colors.danger : colors.borderDefault,
          },
        ]}
      >
        {leadingAccessory}
        <TextInput
          ref={ref}
          style={[styles.input, { color: colors.textPrimary }, style]}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.discovery}
          {...rest}
        />
        {trailingAccessory}
      </View>
      {error ? <Text accessibilityRole="alert" style={[styles.fieldError, { color: colors.danger }]}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  control: {
    minHeight: 50,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  input: {
    flex: 1,
    minWidth: 0,
    minHeight: 50,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.md,
  },
  fieldError: {
    fontSize: fontSize.xs,
    marginTop: 2,
    marginLeft: 2,
  },
});
