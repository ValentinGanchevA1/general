import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { CheckEmailVerificationRequest, StartEmailVerificationResponse, UserProfile } from '@g88/shared';
import { postJson } from '@/api/client';
import { useAppDispatch } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { extractMessage } from '@/utils/extractMessage';
import { ScreenHeader } from '@/components/ScreenHeader';
import { fontSize, spacing, radius, useAppTheme, type ThemeColors } from '@/theme';

export default function EmailVerificationScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const dispatch = useAppDispatch();
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [masked, setMasked] = useState<string | null>(null);
  const [devHint, setDevHint] = useState(false);

  const send = async (): Promise<void> => {
    setSending(true);
    setError(null);
    try {
      const res = await postJson<Record<string, never>, StartEmailVerificationResponse>('/verification/email/start', {});
      setDevHint(res.channel === 'dev');
      setMasked(res.maskedEmail);
    } catch (e) {
      setError(extractMessage(e, 'Could not send code'));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    void Promise.resolve().then(() => { void send(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await postJson<CheckEmailVerificationRequest, UserProfile>('/verification/email/check', { code: code.trim() });
      await dispatch(fetchProfile());
      navigation.goBack();
    } catch (e) {
      setError(extractMessage(e, 'Invalid or expired code'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader title="Verify email" bordered />
      <View style={styles.body}>
        <Icon name="email-check" size={48} color={colors.primary} />
        <Text style={styles.title}>Confirm your email</Text>
        <Text style={styles.blurb}>
          {devHint
            ? `Development verification is active for ${masked || 'your account'}. Use the configured development verification flow.`
            : `We sent a 6-digit code to ${masked || 'your inbox'}. Enter it to unlock stories and the email badge.`}
        </Text>
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="Verification code"
          placeholderTextColor={colors.textFaint}
          keyboardType="number-pad"
          maxLength={10}
          autoFocus
          editable={!busy}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={[styles.button, (busy || code.trim().length < 4) && styles.buttonDisabled]} onPress={() => void confirm()} disabled={busy || code.trim().length < 4}>
          {busy ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.buttonText}>Verify</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.resend} onPress={() => void send()} disabled={sending}>
          <Text style={styles.resendText}>{sending ? 'Sending…' : 'Resend code'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.xl, alignItems: 'center', gap: spacing.sm },
    title: { color: colors.textPrimary, fontSize: 22, fontWeight: '700', marginTop: spacing.sm },
    blurb: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20 },
    input: { width: '100%', marginTop: spacing.sm, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, color: colors.textPrimary, paddingHorizontal: spacing.md, paddingVertical: 14, fontSize: 20, letterSpacing: 3, textAlign: 'center' },
    error: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center' },
    button: { marginTop: spacing.md, width: '100%', backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
    buttonDisabled: { opacity: 0.45 },
    buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
    resend: { marginTop: spacing.sm, padding: spacing.sm },
    resendText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '600' },
  });
}
