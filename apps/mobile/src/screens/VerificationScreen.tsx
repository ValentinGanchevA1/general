import React, { useState } from 'react';
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
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { AccountStackParamList } from '@/navigation/stacks';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type {
  CheckPhoneVerificationRequest,
  StartPhoneVerificationRequest,
  StartPhoneVerificationResponse,
  UserProfile,
} from '@g88/shared';

import { postJson } from '@/api/client';
import { useAppDispatch } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { extractMessage } from '@/utils/extractMessage';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, spacing, radius } from '@/theme';

type Step = 'phone' | 'code';

export function VerificationScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AccountStackParamList, 'Verification'>>();
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState(route.params?.initialPhone ?? '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState(false);

  const start = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const res = await postJson<StartPhoneVerificationRequest, StartPhoneVerificationResponse>(
        '/verification/phone/start',
        { phone: phone.trim() },
      );
      setDevHint(res.channel === 'dev');
      setStep('code');
    } catch (e) {
      setError(extractMessage(e, 'Could not send the code. Check the number and try again.'));
    } finally {
      setBusy(false);
    }
  };

  const check = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await postJson<CheckPhoneVerificationRequest, UserProfile>('/verification/phone/check', {
        phone: phone.trim(),
        code: code.trim(),
      });
      await dispatch(fetchProfile());
      navigation.goBack();
    } catch (e) {
      setError(extractMessage(e, 'That code is incorrect or expired.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Verify phone" />

      <View style={styles.body}>
        <Icon name="cellphone-check" size={48} color={colors.primary} />

        {step === 'phone' ? (
          <>
            <Text style={styles.title}>Add your phone</Text>
            <Text style={styles.blurb}>
              We'll text you a code to confirm it's really you. Use international
              format, e.g. +359888123456.
            </Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+359888123456"
              placeholderTextColor={colors.textFaint}
              keyboardType="phone-pad"
              autoFocus
              editable={!busy}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, (busy || phone.trim().length < 8) && styles.buttonDisabled]}
              onPress={() => void start()}
              disabled={busy || phone.trim().length < 8}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Send code</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.blurb}>
              We sent a code to {phone}.{' '}
              <Text style={styles.link} onPress={() => setStep('phone')}>
                Change number
              </Text>
            </Text>
            {devHint ? <Text style={styles.devHint}>Dev mode: use 000000</Text> : null}
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor={colors.textFaint}
              keyboardType="number-pad"
              maxLength={10}
              autoFocus
              editable={!busy}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, (busy || code.trim().length < 4) && styles.buttonDisabled]}
              onPress={() => void check()}
              disabled={busy || code.trim().length < 4}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => void start()} disabled={busy} style={styles.resend}>
              <Text style={styles.link}>Resend code</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  body: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  title: {
    color: colors.textPrimary,
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  blurb: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  link: { color: colors.primary, fontWeight: '600' },
  devHint: { color: colors.warning, fontSize: fontSize.xs, fontWeight: '600' },
  input: {
    width: '100%',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    fontSize: fontSize.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 24 },
  error: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center' },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  resend: { marginTop: spacing.sm },
});
