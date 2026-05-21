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

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { login, register, clearError, loginWithGoogle } from '@/features/auth/authSlice';

export function AuthScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const submit = () => {
    dispatch(clearError());
    if (mode === 'login') {
      void dispatch(login({ email: email.trim(), password }));
    } else {
      void dispatch(register({ email: email.trim(), password, displayName: displayName.trim() }));
    }
  };

  const toggleMode = () => {
    dispatch(clearError());
    setMode((m) => (m === 'login' ? 'register' : 'login'));
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.logo}>G88</Text>
        <Text style={styles.subtitle}>
          {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
        </Text>

        {mode === 'register' && (
          <TextInput
            style={styles.input}
            placeholder="Display name"
            placeholderTextColor="#666"
            value={displayName}
            onChangeText={setDisplayName}
            autoCapitalize="words"
          />
        )}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={submit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={toggleMode} style={styles.toggle}>
          <Text style={styles.toggleText}>
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={styles.googleBtn}
          onPress={() => { dispatch(clearError()); void dispatch(loginWithGoogle()); }}
          disabled={loading}
        >
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', padding: 24 },
  card: { gap: 12 },
  logo: { color: '#00d4ff', fontSize: 40, fontWeight: '800', textAlign: 'center', marginBottom: 4 },
  subtitle: { color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 12 },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  error: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
  btn: {
    backgroundColor: '#00d4ff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  toggle: { alignItems: 'center', marginTop: 8 },
  toggleText: { color: '#00d4ff', fontSize: 13 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 16, gap: 8 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#2a2a4a' },
  dividerText: { color: '#666', fontSize: 12 },
  googleBtn: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  googleBtnText: { color: '#000', fontWeight: '600', fontSize: 15 },
});
