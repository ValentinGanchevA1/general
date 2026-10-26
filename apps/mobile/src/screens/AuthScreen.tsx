import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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

import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NexaWordmark } from '@/components/Brand/NexaWordmark';
import { GoogleMark } from '@/components/GoogleMark';
import { FormField } from '@/components/FormField';
import { PRIVACY_POLICY_URL, SUPPORT_EMAIL, TERMS_OF_SERVICE_URL } from '@/constants/app';
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
  const insets = useSafeAreaInsets();
  const dispatch = useAppDispatch();
  const { loading, error } = useAppSelector((s) => s.auth);

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
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
      if (loading) return;
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
    setPasswordVisible(false);
    setMode((m) => (m === 'login' ? 'register' : 'login'));
  };

  const openLink = (url: string): void => {
    void Linking.openURL(url).catch(() => {
      Alert.alert('Unable to open link', `Please contact ${SUPPORT_EMAIL} for help.`);
    });
  };

  const requestPasswordHelp = (): void => {
    Alert.alert(
      'Account access help',
      'In-app password reset is not available yet. Contact support for help accessing your account. Never send your password.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Contact support', onPress: () => openLink(`mailto:${SUPPORT_EMAIL}?subject=NEXA%20account%20access%20help`) },
      ],
    );
  };

  const isLogin = mode === 'login';

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 24), paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <View style={styles.heroBlock}>
            <NexaWordmark />
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>
              a gateway to your local world.
            </Text>
          </View>

          <View style={styles.form}>
            {!isLogin ? (
              <Text accessibilityRole="header" style={[styles.title, { color: colors.textPrimary }]}>
                Create your NEXA account
              </Text>
            ) : null}

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
              leadingAccessory={<Icon name="email-outline" size={22} color={colors.textSecondary} style={styles.fieldIcon} />}
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
              leadingAccessory={<Icon name="lock-outline" size={22} color={colors.textSecondary} style={styles.fieldIcon} />}
              trailingAccessory={
                <TouchableOpacity
                  onPress={() => setPasswordVisible((visible) => !visible)}
                  style={styles.visibilityButton}
                  accessibilityRole="button"
                  accessibilityLabel={passwordVisible ? 'Hide password' : 'Show password'}
                  accessibilityState={{ selected: passwordVisible }}
                >
                  <Icon name={passwordVisible ? 'eye-off-outline' : 'eye-outline'} size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              }
              secureTextEntry={!passwordVisible}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              returnKeyType="done"
              onSubmitEditing={submit}
              error={fieldErrors.password}
              accessibilityLabel="Password"
            />

            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabled]}
              onPress={submit}
              disabled={loading}
              activeOpacity={0.82}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading, busy: loading }}
              accessibilityLabel={isLogin ? 'Sign in' : 'Join NEXA'}
            >
              <LinearGradient
                colors={[colors.brandViolet, colors.brandVioletBright]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryFill}
              >
                {loading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                    {isLogin ? 'Sign in' : 'Join NEXA'}
                  </Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {isLogin ? (
              <TouchableOpacity
                onPress={requestPasswordHelp}
                style={styles.textButton}
                accessibilityRole="button"
                accessibilityLabel="Forgot password?"
              >
                <Text style={[styles.linkText, { color: colors.actionPrimary }]}>Forgot password?</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.borderDefault }]} />
          </View>

          <TouchableOpacity
            style={[
              styles.googleButton,
              loading && styles.disabled,
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
            accessibilityState={{ disabled: loading }}
            accessibilityLabel="Continue with Google"
          >
            <GoogleMark />
            <Text style={[styles.googleButtonText, { color: colors.textPrimary }]}>
              Continue with Google
            </Text>
          </TouchableOpacity>

          <View style={styles.accountBlock}>
            <Text style={[styles.accountPrompt, { color: colors.textTertiary }]}>
              {isLogin ? 'New to NEXA?' : 'Already on NEXA?'}
            </Text>
            <TouchableOpacity
              onPress={toggleMode}
              disabled={loading}
              style={styles.textButton}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
            >
              <Text style={[styles.accountLink, { color: colors.actionPrimary }]}>
                {isLogin ? 'Create account' : 'Sign in'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.legalRow}>
            <TouchableOpacity accessibilityRole="link" onPress={() => openLink(TERMS_OF_SERVICE_URL)} style={styles.legalButton}>
              <Text style={[styles.legalLink, { color: colors.textTertiary }]}>Terms of Service</Text>
            </TouchableOpacity>
            <Text accessible={false} style={{ color: colors.textTertiary }}>·</Text>
            <TouchableOpacity accessibilityRole="link" onPress={() => openLink(PRIVACY_POLICY_URL)} style={styles.legalButton}>
              <Text style={[styles.legalLink, { color: colors.textTertiary }]}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xxl },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  heroBlock: { alignItems: 'center', marginTop: 24, marginBottom: 56, gap: spacing.md },
  tagline: { fontSize: fontSize.sm, textAlign: 'center', letterSpacing: 1.1 },
  form: { gap: spacing.md },
  title: { fontSize: fontSize.lg, fontWeight: '600', textAlign: 'center', marginBottom: spacing.sm },
  fieldIcon: { marginLeft: spacing.lg },
  visibilityButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  error: { fontSize: fontSize.sm, lineHeight: 19, textAlign: 'center' },
  primaryButton: { borderRadius: radius.md, overflow: 'hidden', marginTop: spacing.sm },
  primaryFill: { minHeight: 52, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  primaryButtonText: { fontSize: fontSize.lg, fontWeight: '500' },
  disabled: { opacity: 0.55 },
  textButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.sm },
  linkText: { fontSize: fontSize.md },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xl, marginBottom: spacing.xl, gap: spacing.lg },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: fontSize.sm },
  googleButton: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.md },
  googleButtonText: { fontWeight: '500', fontSize: fontSize.md, flexShrink: 1 },
  accountBlock: { marginTop: spacing.xl, alignItems: 'center' },
  accountPrompt: { fontSize: fontSize.md },
  accountLink: { fontSize: fontSize.lg, fontWeight: '600' },
  legalRow: { marginTop: 28, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', columnGap: spacing.sm },
  legalButton: { minHeight: 44, justifyContent: 'center' },
  legalLink: { fontSize: fontSize.xs, textDecorationLine: 'underline' },
});
