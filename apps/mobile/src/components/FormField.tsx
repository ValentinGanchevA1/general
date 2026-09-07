import React, { forwardRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { colors, fontSize, spacing, radius } from '@/theme';

export interface FormFieldProps extends TextInputProps {
  error?: string | undefined;
  label?: string | undefined;
}

/**
 * TextInput + optional label + inline error (AuthScreen visual pattern).
 * Pass a ref to chain focus with returnKeyType="next" / onSubmitEditing.
 */
export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { error, label, style, ...rest },
  ref,
) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={colors.textFaint}
        {...rest}
      />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    borderRadius: radius.md,
    padding: 14,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inputError: { borderColor: colors.danger },
  fieldError: {
    color: colors.danger,
    fontSize: fontSize.xs,
    marginTop: 2,
    marginLeft: 2,
  },
});
