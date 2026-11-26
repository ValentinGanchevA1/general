import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { NexaWordmark } from '@/components/Brand/NexaWordmark';
import {
  CHILD_SAFETY_STANDARDS_URL,
  PRIVACY_POLICY_URL,
  SUPPORT_EMAIL,
  TERMS_OF_SERVICE_URL,
} from '@/constants/app';
import { acceptUgcTerms, checkUgcTermsAcceptance } from '@/features/auth/termsAcceptanceSlice';
import { logout } from '@/features/auth/authSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

export function TermsAcceptanceScreen({ onContinueWithoutPosting }: Readonly<{ onContinueWithoutPosting?: () => void }>): React.JSX.Element {
  const { colors } = useAppTheme();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const gate = useAppSelector((state) => state.termsAcceptance);
  const [checked, setChecked] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const matchesSession = userId !== null && gate.userId === userId;
  const phase = matchesSession ? gate.phase : 'checking';
  const busy = phase === 'checking' || phase === 'accepting' || phase === 'idle';

  const retry = (): void => {
    if (!userId || busy) return;
    setLocalError(null);
    void dispatch(checkUgcTermsAcceptance(userId));
  };

  const accept = (): void => {
    if (busy || !checked || !userId || !gate.termsVersion || !gate.termsSha256) return;
    setLocalError(null);
    void dispatch(acceptUgcTerms({
      userId,
      termsVersion: gate.termsVersion,
      termsSha256: gate.termsSha256,
    }));
  };

  const signOut = (): void => {
    if (phase === 'accepting') return;
    void dispatch(logout());
  };

  const openUrl = (url: string): void => {
    void Linking.openURL(url).catch(() => {
      setLocalError('This page could not be opened. Try again later.');
    });
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="NEXUS Terms acceptance"
    >
      <NexaWordmark />
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>
          Before you post
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          Accept the current NEXUS Terms before creating or uploading content or sending messages. You can continue without accepting to browse, report content, block users, and manage your account; posting and uploads will remain blocked.
        </Text>
      </View>

      {busy ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Checking Terms acceptance" size="large" color={colors.actionPrimary} />
          <Text style={{ color: colors.textSecondary }}>
            {phase === 'accepting' ? 'Saving your acceptance…' : 'Checking the current Terms…'}
          </Text>
        </View>
      ) : null}

      {phase === 'required' ? (
        <View style={styles.form}>
          <Text style={[styles.version, { color: colors.textSecondary }]}>
            Current Terms version: {gate.termsVersion}
          </Text>
          <TouchableOpacity
            accessibilityRole="link"
            accessibilityLabel="Read NEXUS Terms of Service"
            style={styles.linkButton}
            onPress={() => openUrl(TERMS_OF_SERVICE_URL)}
          >
            <Text style={[styles.linkText, { color: colors.actionPrimary }]}>Read Terms of Service</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityLabel="I have read and agree to the current NEXUS Terms of Service"
            accessibilityState={{ checked, disabled: busy }}
            style={styles.checkRow}
            onPress={() => { setChecked((value) => !value); setLocalError(null); }}
            disabled={busy}
          >
            <View style={[
              styles.checkbox,
              { borderColor: checked ? colors.actionPrimary : colors.textMuted },
              checked ? { backgroundColor: colors.actionPrimary } : null,
            ]}>
              {checked ? <Text style={[styles.checkmark, { color: colors.onPrimary }]}>✓</Text> : null}
            </View>
            <Text style={[styles.checkLabel, { color: colors.textPrimary }]}>
              I have read and agree to the current Terms of Service.
            </Text>
          </TouchableOpacity>
          {gate.error || localError ? (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>
              {localError ?? gate.error}
            </Text>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Accept Terms and continue"
            accessibilityState={{ disabled: busy || !checked }}
            style={[styles.button, { backgroundColor: colors.actionPrimary }, (busy || !checked) && styles.disabled]}
            onPress={accept}
            disabled={busy || !checked}
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Accept and continue</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {phase === 'error' ? (
        <View style={styles.form}>
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>
            {gate.error ?? 'The current Terms could not be verified. Posting and uploads stay unavailable until verification succeeds.'}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry Terms check"
            style={[styles.button, { backgroundColor: colors.actionPrimary }]}
            onPress={retry}
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {localError && phase !== 'required' && phase !== 'error' ? (
        <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>{localError}</Text>
      ) : null}

      <View style={styles.links}>
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel="Report a child safety concern by email"
          style={styles.linkButton}
          onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}?subject=NEXUS%20Child%20Safety%20Report`)}
        >
          <Text style={[styles.linkText, { color: colors.actionPrimary }]}>Report a safety concern</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel="Read Privacy Policy"
          style={styles.linkButton}
          onPress={() => openUrl(PRIVACY_POLICY_URL)}
        >
          <Text style={[styles.linkText, { color: colors.actionPrimary }]}>Privacy Policy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          accessibilityRole="link"
          accessibilityLabel="Read Child Safety Standards"
          style={styles.linkButton}
          onPress={() => openUrl(CHILD_SAFETY_STANDARDS_URL)}
        >
          <Text style={[styles.linkText, { color: colors.actionPrimary }]}>Child Safety Standards</Text>
        </TouchableOpacity>
      </View>

      <Text style={[styles.description, { color: colors.textSecondary, maxWidth: 420 }]}>
        Do not attach or forward suspected illegal imagery. For immediate danger, contact local emergency services.
      </Text>
      {onContinueWithoutPosting ? (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Continue without accepting Terms; posting stays disabled"
          accessibilityState={{ disabled: phase === 'accepting' }}
          style={styles.secondaryButton}
          onPress={onContinueWithoutPosting}
          disabled={phase === 'accepting'}
        >
          <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Continue without accepting</Text>
        </TouchableOpacity>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityState={{ disabled: phase === 'accepting' }}
        style={styles.secondaryButton}
        onPress={signOut}
        disabled={phase === 'accepting'}
      >
        <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xxl,
    gap: spacing.xl,
  },
  copy: { width: '100%', maxWidth: 420, gap: spacing.md, alignItems: 'center' },
  heading: { fontSize: fontSize.xl, fontWeight: '700', textAlign: 'center' },
  description: { fontSize: fontSize.md, lineHeight: 23, textAlign: 'center' },
  form: { width: '100%', maxWidth: 420, gap: spacing.md },
  version: { fontSize: fontSize.sm, textAlign: 'center' },
  linkButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: fontSize.md, fontWeight: '600', textDecorationLine: 'underline' },
  checkRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  checkbox: { width: 26, height: 26, borderWidth: 2, borderRadius: radius.xs, alignItems: 'center', justifyContent: 'center' },
  checkmark: { fontSize: fontSize.md, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: fontSize.sm, lineHeight: 20 },
  error: { fontSize: fontSize.sm, lineHeight: 20 },
  loading: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  button: { borderRadius: radius.md, minHeight: 52, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  disabled: { opacity: 0.55 },
  buttonText: { fontSize: fontSize.md, fontWeight: '600' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: fontSize.md, fontWeight: '500' },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.lg },
});
