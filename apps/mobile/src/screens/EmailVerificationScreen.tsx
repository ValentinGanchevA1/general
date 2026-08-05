import React, { useEffect, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type {
  CheckEmailVerificationRequest,
  StartEmailVerificationResponse,
  UserProfile,
} from '@g88/shared';

import { postJson } from '@/api/client';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { extractMessage } from '@/utils/extractMessage';

/**
 * Email ownership OTP — required by the soft story-post gate (and badge ladder).
 * Dev: code is logged server-side; use DEV_OTP_CODE / 000000 when Twilio is off.
 */
export function EmailVerificationScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.profile);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devHint, setDevHint] = useState(false);
  const [masked, setMasked] = useState(profile?.email ?? '');

  const send = async (): Promise<void> => {
    setSending(true);
    setError(null);
    try {
      const res = await postJson<Record<string, never>, StartEmailVerificationResponse>(
        '/verification/email/start',
        {},
      );
      setDevHint(res.channel === 'dev');
      setMasked(res.maskedEmail);
    } catch (e) {
      setError(extractMessage(e, 'Could not send code'));
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await postJson<CheckEmailVerificationRequest, UserProfile>('/verification/email/check', {
        code: code.trim(),
      });
      await dispatch(fetchProfile());
      navigation.goBack();
    } catch (e) {
      setError(extractMessage(e, 'Invalid or expired code'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify email</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.body}>
        <Icon name="email-check" size={48} color="#00d4ff" />
        <Text style={styles.title}>Confirm your email</Text>
        <Text style={styles.blurb}>
          We sent a 6-digit code to {masked || 'your inbox'}. Enter it to unlock stories and
          the email badge.
        </Text>
        {devHint ? (
          <Text style={styles.devHint}>
            Dev mode: use code 000000 (or DEV_OTP_CODE). Server also logs the code.
          </Text>
        ) : null}
        <TextInput
          style={styles.input}
          value={code}
          onChangeText={setCode}
          placeholder="000000"
          placeholderTextColor="#555"
          keyboardType="number-pad"
          maxLength={10}
          autoFocus
          editable={!busy}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity
          style={[styles.button, (busy || code.trim().length < 4) && styles.buttonDisabled]}
          onPress={() => void confirm()}
          disabled={busy || code.trim().length < 4}
        >
          {busy ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.buttonText}>Confirm</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => void send()} disabled={sending} style={styles.resend}>
          {sending ? (
            <ActivityIndicator color="#00d4ff" />
          ) : (
            <Text style={styles.resendText}>Resend code</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

export default EmailVerificationScreen;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 52,
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  body: { padding: 24, alignItems: 'center', gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 8 },
  blurb: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  devHint: {
    color: '#f0c040',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  input: {
    width: '100%',
    marginTop: 12,
    backgroundColor: '#14141c',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    color: '#fff',
    fontSize: 22,
    letterSpacing: 6,
    textAlign: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  error: { color: '#ff6b6b', fontSize: 13, alignSelf: 'flex-start' },
  button: {
    width: '100%',
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 16 },
  resend: { marginTop: 16, padding: 8 },
  resendText: { color: '#00d4ff', fontSize: 14 },
});
