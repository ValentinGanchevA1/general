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
import { useNavigation } from '@react-navigation/native';
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

type Step = 'phone' | 'code';

export function VerificationScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify phone</Text>
        <View style={styles.back} />
      </View>

      <View style={styles.body}>
        <Icon name="cellphone-check" size={48} color="#00d4ff" />

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
              placeholderTextColor="#555"
              keyboardType="phone-pad"
              autoFocus
              editable={!busy}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={[styles.button, (busy || phone.trim().length < 8) && styles.buttonDisabled]}
              onPress={start}
              disabled={busy || phone.trim().length < 8}
            >
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Send code</Text>}
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
            {devHint ? (
              <Text style={styles.devHint}>Dev mode: use 000000</Text>
            ) : null}
            <TextInput
              style={[styles.input, styles.codeInput]}
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
              onPress={check}
              disabled={busy || code.trim().length < 4}
            >
              {busy ? <ActivityIndicator color="#000" /> : <Text style={styles.buttonText}>Verify</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={start} disabled={busy} style={styles.resend}>
              <Text style={styles.link}>Resend code</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 56,
  },
  back: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { flex: 1, alignItems: 'center', paddingHorizontal: 32, paddingTop: 32, gap: 12 },
  title: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 8 },
  blurb: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  link: { color: '#00d4ff', fontWeight: '600' },
  devHint: { color: '#ff9d3c', fontSize: 12, fontWeight: '600' },
  input: {
    width: '100%',
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2a2a34',
    color: '#fff',
    fontSize: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 8,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 24 },
  error: { color: '#ff4444', fontSize: 13, textAlign: 'center' },
  button: {
    width: '100%',
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: '#000', fontWeight: '700', fontSize: 16 },
  resend: { marginTop: 8 },
});
