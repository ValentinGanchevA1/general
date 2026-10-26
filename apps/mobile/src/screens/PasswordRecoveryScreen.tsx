import React, { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NexaWordmark } from '@/components/Brand/NexaWordmark';
import { FormField } from '@/components/FormField';
import { clearPasswordRecovery, clearRecoveryError, requestPasswordReset, resetPassword } from '@/features/auth/passwordResetSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

interface Props { readonly initialEmail: string; readonly onClose: (email: string) => void }

const STEP_LABELS = {
  email: { title: 'Forgot password?', action: 'Send reset code' },
  code: { title: 'Reset password', action: 'Update password' },
  success: { title: 'Password updated', action: 'Back to sign in' },
} as const;

// Split at delimiters so a long, invalid domain cannot trigger regex backtracking.
function isRecoveryEmailValid(email: string): boolean {
  if (email.length > 254 || /\s/.test(email)) return false;
  const at = email.indexOf('@');
  if (at <= 0 || at !== email.lastIndexOf('@')) return false;
  const dot = email.indexOf('.', at + 2);
  return dot !== -1 && dot < email.length - 1;
}

function utf8CodePointBytes(point: number): number {
  if (point <= 0x7f) return 1;
  if (point <= 0x7ff) return 2;
  if (point <= 0xffff) return 3;
  return 4;
}

function validateReset(resetCode: string, password: string, confirmation: string): string | null {
  if (!/^\d{8}$/.test(resetCode)) return 'Enter the 8-digit code from your email.';
  let bytes = 0;
  for (const char of password) {
    bytes += utf8CodePointBytes(char.codePointAt(0) ?? 0);
  }
  if (password.length < 8 || bytes > 72) return 'Use at least 8 characters and no more than 72 UTF-8 bytes.';
  if (password !== confirmation) return 'Passwords do not match.';
  return null;
}

export function PasswordRecoveryScreen({ initialEmail, onClose }: Props): React.JSX.Element {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { step, busy, error, message, retryAt } = useAppSelector((state) => state.passwordReset);
  const [email, setEmail] = useState(initialEmail);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [visible, setVisible] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1_000));

  useEffect(() => {
    if (step !== 'code') return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [step]);

  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) {
        dispatch(clearPasswordRecovery());
        onClose(email.trim());
      }
      return true;
    });
    return () => back.remove();
  }, [busy, dispatch, email, onClose]);

  const clearError = (): void => { setValidationError(null); dispatch(clearRecoveryError()); };
  const close = (): void => { dispatch(clearPasswordRecovery()); onClose(email.trim()); };
  const send = (): void => {
    if (busy || (step === 'code' && Date.now() < retryAt)) return;
    clearError();
    if (!isRecoveryEmailValid(email.trim())) {
      setValidationError('Enter a valid email address.'); return;
    }
    void dispatch(requestPasswordReset({ email: email.trim() })).then((action) => {
      if (requestPasswordReset.fulfilled.match(action)) {
        setResetCode('');
        setNow(Date.now());
      }
    });
  };
  const confirm = (): void => {
    if (busy) return;
    clearError();
    const issue = validateReset(resetCode, newPassword, confirmation);
    if (issue) { setValidationError(issue); return; }
    void dispatch(resetPassword({ email: email.trim(), resetCode, newPassword })).then((action) => {
      if (resetPassword.fulfilled.match(action)) {
        setResetCode(''); setNewPassword(''); setConfirmation(''); setVisible(false);
      }
    });
  };

  const primaryAction = { email: send, code: confirm, success: close }[step];
  const labels = STEP_LABELS[step];
  const visibilityLabel = visible ? 'Hide passwords' : 'Show passwords';
  const displayedError = validationError ?? error;

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.canvas }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.scroll, { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.content}>
          <View style={styles.brand}><NexaWordmark /></View>
          <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
            {labels.title}
          </Text>
          <Text accessibilityLiveRegion="polite" style={[styles.description, { color: colors.textSecondary }]}>
            {step === 'email'
              ? 'Enter your account email to request a one-time reset code. If you signed up with Google, you can continue with Google instead.'
              : message}
          </Text>
          {step === 'email' ? (
            <FormField accessibilityLabel="Recovery email" placeholder="Email" value={email} editable={!busy}
              onChangeText={(value) => { setEmail(value); clearError(); }} keyboardType="email-address"
              autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254}
              returnKeyType="send" onSubmitEditing={send} />
          ) : null}
          {step === 'code' ? (
            <>
              <Text style={[styles.description, { color: colors.textSecondary }]}>{email.trim()} · Code expires 15 minutes after the request.</Text>
              <FormField accessibilityLabel="Reset code" placeholder="8-digit code" value={resetCode} editable={!busy}
                keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="off" maxLength={8}
                onChangeText={(value) => { setResetCode(value.replace(/\D/g, '')); clearError(); }} />
              <FormField accessibilityLabel="New password" placeholder="New password" value={newPassword} editable={!busy}
                secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password"
                onChangeText={(value) => { setNewPassword(value); clearError(); }} />
              <FormField accessibilityLabel="Confirm password" placeholder="Confirm password" value={confirmation} editable={!busy}
                secureTextEntry={!visible} autoCapitalize="none" autoCorrect={false} autoComplete="new-password"
                onChangeText={(value) => { setConfirmation(value); clearError(); }} returnKeyType="done" onSubmitEditing={confirm} />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={visibilityLabel}
                onPress={() => setVisible((value) => !value)} style={styles.textButton}>
                <Text style={{ color: colors.actionPrimary }}>{visibilityLabel}</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {displayedError ? <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.danger }}>{displayedError}</Text> : null}
          <TouchableOpacity accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy, busy }}
            style={[styles.primary, { backgroundColor: colors.actionPrimary }, busy && styles.disabled]}
            onPress={primaryAction}>
            {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.buttonText, { color: colors.onPrimary }]}>{labels.action}</Text>}
          </TouchableOpacity>
          {step === 'code' ? (
            <>
              <TouchableOpacity accessibilityRole="button" accessibilityState={{ disabled: busy || remaining > 0 }}
                disabled={busy || remaining > 0} style={styles.textButton} onPress={send}>
                <Text style={{ color: remaining > 0 ? colors.textTertiary : colors.actionPrimary }}>{remaining > 0 ? `Resend code in ${remaining}s` : 'Resend code'}</Text>
              </TouchableOpacity>
              <TouchableOpacity accessibilityRole="button" disabled={busy} style={styles.textButton}
                onPress={() => { dispatch(clearPasswordRecovery()); clearError(); setResetCode(''); setNewPassword(''); setConfirmation(''); setVisible(false); }}>
                <Text style={{ color: colors.actionPrimary }}>Use another email</Text>
              </TouchableOpacity>
            </>
          ) : null}
          {step !== 'success' ? <TouchableOpacity accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy }} style={styles.textButton} onPress={close}>
            <Text style={{ color: colors.actionPrimary }}>Back to sign in</Text>
          </TouchableOpacity> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center', gap: spacing.md },
  brand: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: fontSize.xl, fontWeight: '600', textAlign: 'center' },
  description: { fontSize: fontSize.sm, lineHeight: 20, textAlign: 'center', marginBottom: spacing.sm },
  primary: { minHeight: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  disabled: { opacity: 0.55 },
  buttonText: { fontSize: fontSize.md, fontWeight: '600' },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
