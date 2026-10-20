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
}

/** TextInput + optional label + inline error using the active NEXA theme. */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { error, label, style, ...rest },
  ref,
) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.wrap}>
      {label ? <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text> : null}
      <TextInput
        ref={ref}
        style={[
          styles.input,
          {
            backgroundColor: colors.surfaceSecondary,
            color: colors.textPrimary,
            borderColor: error ? colors.danger : colors.borderDefault,
          },
          style,
        ]}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.discovery}
        {...rest}
      />
      {error ? <Text style={[styles.fieldError, { color: colors.danger }]}>{error}</Text> : null}
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
  input: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.md,
    borderWidth: 1,
  },
  fieldError: {
    fontSize: fontSize.xs,
    marginTop: 2,
    marginLeft: 2,
  },
});
