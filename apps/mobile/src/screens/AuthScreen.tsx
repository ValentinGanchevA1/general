import React, { useCallback, useState } from 'react';
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
import { colors, spacing, radius, fontSize } from '@/theme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
      const action = await dispatch(
        register({ email: email.trim(), password, displayName: displayName.trim() }),
      );
      if (register.fulfilled.match(action) && phone.trim().length >= 8) {
        await setPendingPhoneVerify(phone.trim());
      }
    })();
  };

  const toggleMode = () => {
    dispatch(clearError());
    setFieldErrors({});
    setMode((m) => (m === 'login' ? 'register' : 'login'));
  };

  const openTerms = () => {
    void Linking.openURL(TERMS_OF_SERVICE_URL);
  };

  const openPrivacy = () => {
    void Linking.openURL(PRIVACY_POLICY_URL);
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.logo}>G88</Text>
          <Text style={styles.subtitle}>
            {mode === 'login' ? 'Sign in to continue' : 'Create your account'}
          </Text>

          {mode === 'register' && (
            <View>
              <TextInput
                style={[styles.input, fieldErrors.displayName ? styles.inputError : null]}
                placeholder="Display name"
                placeholderTextColor={colors.textFaint}
                value={displayName}
                onChangeText={(t) => {
                  setDisplayName(t);
                  clearFieldError('displayName');
                }}
                autoCapitalize="words"
                accessibilityLabel="Display name"
              />
              {fieldErrors.displayName ? (
                <Text style={styles.fieldError}>{fieldErrors.displayName}</Text>
              ) : null}
            </View>
          )}

          <View>
            <TextInput
              style={[styles.input, fieldErrors.email ? styles.inputError : null]}
              placeholder="Email"
              placeholderTextColor={colors.textFaint}
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                clearFieldError('email');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              accessibilityLabel="Email"
            />
            {fieldErrors.email ? (
              <Text style={styles.fieldError}>{fieldErrors.email}</Text>
            ) : null}
          </View>

          {mode === 'register' ? (
            <TextInput
              style={styles.input}
              placeholder="Phone (optional) e.g. +359888123456"
              placeholderTextColor={colors.textFaint}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              autoComplete="tel"
              accessibilityLabel="Phone number optional"
            />
          ) : null}

          <View>
            <TextInput
              style={[styles.input, fieldErrors.password ? styles.inputError : null]}
              placeholder="Password"
              placeholderTextColor={colors.textFaint}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                clearFieldError('password');
              }}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={submit}
              accessibilityLabel="Password"
            />
            {fieldErrors.password ? (
              <Text style={styles.fieldError}>{fieldErrors.password}</Text>
            ) : null}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.btn}
            onPress={submit}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel={mode === 'login' ? 'Sign in' : 'Create account'}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
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
            onPress={() => {
              dispatch(clearError());
              setFieldErrors({});
              void dispatch(loginWithGoogle());
            }}
            disabled={loading}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <Text style={styles.googleBtnText}>Continue with Google</Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            By continuing you agree to our{' '}
            <Text style={styles.legalLink} onPress={openTerms}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={styles.legalLink} onPress={openPrivacy}>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.xxl,
    paddingVertical: 40,
  },
  card: { gap: spacing.md },
  logo: {
    color: colors.primary,
    fontSize: 40,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    color: colors.textPrimary,
    borderRadius: 10,
    padding: 14,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  inputError: {
    borderColor: colors.danger,
  },
  fieldError: {
    color: colors.danger,
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    marginLeft: 2,
  },
  error: { color: colors.danger, fontSize: fontSize.sm, textAlign: 'center' },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  btnText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  toggle: { alignItems: 'center', marginTop: spacing.sm },
  toggleText: { color: colors.primary, fontSize: fontSize.sm },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.borderStrong },
  dividerText: { color: colors.textFaint, fontSize: fontSize.xs },
  googleBtn: {
    backgroundColor: colors.textPrimary,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  googleBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: fontSize.md },
  legal: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: spacing.lg,
  },
  legalLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
