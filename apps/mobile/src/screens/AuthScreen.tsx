import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { login, register, clearError, loginWithGoogle } from '@/features/auth/authSlice';
import { setPendingPhoneVerify } from '@/services/pendingPhone';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/constants/app';
import { FormField } from '@/components/FormField';
import { colors, spacing, fontSize } from '@/theme';

// Linear character classes only — avoids super-linear backtracking on adversarial input.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const MIN_PASSWORD_LEN = 8;

interface FieldErrors {
  email?: string;
  password?: string;
  displayName?: string;
}

function validate(
  mode: 'login' | 'register',
  email: string,
  password: string,
  displayName: string,
): FieldErrors {
  const errors: FieldErrors = {};
  const e = email.trim();
  if (!e) {
    errors.email = 'Email is required';
  } else if (!EMAIL_RE.test(e)) {
    errors.email = 'Enter a valid email address';
  }
  if (!password) {
    errors.password = 'Password is required';
  } else if (password.length < MIN_PASSWORD_LEN) {
    errors.password = `Password must be at least ${MIN_PASSWORD_LEN} characters`;
  }
  if (mode === 'register') {
    const name = displayName.trim();
    if (!name) {
      errors.displayName = 'Display name is required';
    } else if (name.length < 2) {
      errors.displayName = 'Display name must be at least 2 characters';
    }
  }
  return errors;
}

export function AuthScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const phoneRef = useRef<TextInput>(null);

  const clearFieldError = useCallback((key: keyof FieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const submit = () => {
    void (async () => {
      dispatch(clearError());
      const nextErrors = validate(mode, email, password, displayName);
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      if (mode === 'login') {
        void dispatch(login({ email: email.trim(), password }));
        return;
      }

      const result = await dispatch(
        register({ email: email.trim(), password, displayName: displayName.trim() }),
      );
      if (register.fulfilled.match(result) && phone.trim()) {
        setPendingPhoneVerify(phone.trim());
      }
    })();
  };

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setFieldErrors({});
    dispatch(clearError());
  };

  const openLegal = (url: string) => {
    void Linking.openURL(url);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brand}>G88</Text>
        <Text style={styles.subtitle}>{mode === 'login' ? 'Welcome back' : 'Create account'}</Text>

        <View style={styles.form}>
          {mode === 'register' ? (
            <FormField
              placeholder="Display name"
              value={displayName}
              onChangeText={(t) => {
                setDisplayName(t);
                clearFieldError('displayName');
              }}
              autoCapitalize="words"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              error={fieldErrors.displayName}
              accessibilityLabel="Display name"
            />
          ) : null}

          <FormField
            ref={emailRef}
            placeholder="Email"
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              clearFieldError('email');
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="next"
            onSubmitEditing={() =>
              mode === 'register' ? phoneRef.current?.focus() : passwordRef.current?.focus()
            }
            error={fieldErrors.email}
            accessibilityLabel="Email"
          />

          {mode === 'register' ? (
            <FormField
              ref={phoneRef}
              placeholder="Phone (optional) e.g. +359888123456"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              accessibilityLabel="Phone number optional"
            />
          ) : null}

          <FormField
            ref={passwordRef}
            placeholder="Password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              clearFieldError('password');
            }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={submit}
            error={fieldErrors.password}
            accessibilityLabel="Password"
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryBtn, loading && styles.btnDisabled]}
            onPress={submit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={mode === 'login' ? 'Log in' : 'Create account'}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={styles.primaryBtnText}>{mode === 'login' ? 'Log in' : 'Sign up'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.googleBtn}
            onPress={() => void dispatch(loginWithGoogle())}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}
            accessibilityRole="button"
          >
            <Text style={styles.switchText}>
              {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Log in'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            By continuing you agree to our{' '}
            <Text style={styles.legalLink} onPress={() => openLegal(TERMS_OF_SERVICE_URL)}>
              Terms
            </Text>{' '}
            and{' '}
            <Text style={styles.legalLink} onPress={() => openLegal(PRIVACY_POLICY_URL)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  brand: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  form: { gap: spacing.md },
  error: { color: colors.danger, fontSize: fontSize.sm },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  googleBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  googleBtnText: { color: colors.text, fontWeight: '600', fontSize: fontSize.md },
  switchText: {
    color: colors.primary,
    textAlign: 'center',
    marginTop: spacing.sm,
    fontSize: fontSize.sm,
  },
  legal: {
    color: colors.textSecondary,
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 18,
  },
  legalLink: { color: colors.primary, textDecorationLine: 'underline' },
});
