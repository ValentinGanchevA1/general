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

import { BrandLogo } from '@/components/Brand/BrandLogo';
import { NexaDiscoveryHero } from '@/components/Brand/NexaDiscoveryHero';
import { FormField } from '@/components/FormField';
import { PRIVACY_POLICY_URL, TERMS_OF_SERVICE_URL } from '@/constants/app';
import { clearError, login, loginWithGoogle, register } from '@/features/auth/authSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { setPendingPhoneVerify } from '@/services/pendingPhone';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

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
  const { colors } = useAppTheme();
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

  const submit = (): void => {
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

  const toggleMode = (): void => {
    dispatch(clearError());
    setFieldErrors({});
    setMode((m) => (m === 'login' ? 'register' : 'login'));
  };

  const openTerms = (): void => {
    void Linking.openURL(TERMS_OF_SERVICE_URL);
  };

  const openPrivacy = (): void => {
    void Linking.openURL(PRIVACY_POLICY_URL);
  };

  const isLogin = mode === 'login';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroBlock}>
          <BrandLogo size={62} style={styles.logoImage} />
          <Text style={[styles.eyebrow, { color: colors.discovery }]}>LOCAL DISCOVERY</Text>
          <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
            {isLogin ? 'See what’s happening nearby.' : 'Start discovering around you.'}
          </Text>
          <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>
            People, events and listings — live on the map.
          </Text>
          <NexaDiscoveryHero compact />
        </View>

        <View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surfacePrimary,
              borderColor: colors.borderDefault,
            },
          ]}
        >
          <View style={styles.panelHeading}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              {isLogin ? 'Welcome back' : 'Create your NEXA account'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
              {isLogin
                ? 'Sign in to return to your local map.'
                : 'One account for discovery, connection and participation.'}
            </Text>
          </View>

          {mode === 'register' ? (
            <FormField
              placeholder="Display name"
              value={displayName}
              onChangeText={(text) => {
                setDisplayName(text);
                clearFieldError('displayName');
              }}
              autoCapitalize="words"
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
            onChangeText={(text) => {
              setEmail(text);
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
            onChangeText={(text) => {
              setPassword(text);
              clearFieldError('password');
            }}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={submit}
            error={fieldErrors.password}
            accessibilityLabel="Password"
          />

          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={isLogin ? 'Sign in' : 'Join NEXA'}
          >
            {loading ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                {isLogin ? 'Sign in' : 'Join NEXA'}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={toggleMode}
            style={styles.toggle}
            activeOpacity={0.72}
            accessibilityRole="button"
          >
            <Text style={[styles.toggleText, { color: colors.actionPrimary }]}>
              {isLogin ? 'New to NEXA? Create account' : 'Already on NEXA? Sign in'}
            </Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
          </View>

          <TouchableOpacity
            style={[
              styles.googleButton,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.borderStrong,
              },
            ]}
            onPress={() => {
              dispatch(clearError());
              setFieldErrors({});
              void dispatch(loginWithGoogle());
            }}
            disabled={loading}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Continue with Google"
          >
            <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          <Text style={[styles.privacyNote, { color: colors.textTertiary }]}>
            You control whether your profile is visible on the map.
          </Text>

          <Text style={[styles.legal, { color: colors.textTertiary }]}>
            By continuing you agree to our{' '}
            <Text style={[styles.legalLink, { color: colors.discovery }]} onPress={openTerms}>
              Terms of Service
            </Text>
            {' '}and{' '}
            <Text style={[styles.legalLink, { color: colors.discovery }]} onPress={openPrivacy}>
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
  root: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 28,
    paddingBottom: 36,
  },
  heroBlock: {
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  logoImage: {
    marginBottom: 2,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  heroTitle: {
    maxWidth: 360,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  heroSubtitle: {
    maxWidth: 340,
    fontSize: fontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  panel: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.xl,
  },
  panelHeading: {
    gap: 4,
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    lineHeight: 19,
    textAlign: 'center',
  },
  error: {
    fontSize: fontSize.sm,
    lineHeight: 19,
    textAlign: 'center',
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  primaryButtonText: {
    fontWeight: '800',
    fontSize: fontSize.md,
  },
  toggle: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xs,
    gap: spacing.sm,
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: fontSize.xs },
  googleButton: {
    minHeight: 50,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleButtonText: {
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  privacyNote: {
    fontSize: fontSize.xs,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  legal: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  legalLink: {
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});
