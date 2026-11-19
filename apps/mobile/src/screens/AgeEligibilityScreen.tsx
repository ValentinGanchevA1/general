import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { NexaWordmark } from '@/components/Brand/NexaWordmark';
import { BirthDateField } from '@/components/Profile/ProfileOriginFields';
import {
  checkAgeEligibility,
  completeAgeEligibility,
} from '@/features/auth/ageEligibilitySlice';
import { logout } from '@/features/auth/authSlice';
import { registrationBirthDateError } from '@/features/auth/registrationAge';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

/** The only route reachable by an authenticated user without confirmed age status. */
export function AgeEligibilityScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const dispatch = useAppDispatch();
  const userId = useAppSelector((state) => state.auth.user?.id ?? null);
  const gate = useAppSelector((state) => state.ageEligibility);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const matchesSession = userId !== null && gate.userId === userId;
  const phase = matchesSession ? gate.phase : 'checking';
  const busy = phase === 'checking' || phase === 'completing' || phase === 'idle';

  const submit = (): void => {
    if (busy || !userId) return;
    const validationError = registrationBirthDateError(dateOfBirth);
    setLocalError(validationError);
    if (validationError) return;
    void dispatch(completeAgeEligibility({ userId, dateOfBirth }));
  };

  const retry = (): void => {
    if (!userId || busy) return;
    setLocalError(null);
    void dispatch(checkAgeEligibility(userId));
  };

  const signOut = (): void => {
    if (phase === 'completing') return;
    void dispatch(logout());
  };

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { backgroundColor: colors.canvas }]}
      keyboardShouldPersistTaps="handled"
      accessibilityLabel="NEXUS account age eligibility"
    >
      <NexaWordmark />
      <View style={styles.copy}>
        <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>
          Confirm your age
        </Text>
        <Text style={[styles.description, { color: colors.textSecondary }]}>
          NEXUS Social is for adults 18 and over. Access to nearby people, events,
          messages and the map stays restricted until the server confirms eligibility.
        </Text>
      </View>

      {busy ? (
        <View style={styles.loading}>
          <ActivityIndicator accessibilityLabel="Checking age eligibility" size="large" color={colors.actionPrimary} />
          <Text style={{ color: colors.textSecondary }}>
            {phase === 'completing' ? 'Confirming your eligibility…' : 'Checking your account…'}
          </Text>
        </View>
      ) : null}

      {phase === 'required' ? (
        <View style={styles.form}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>Date of birth</Text>
          <BirthDateField
            value={dateOfBirth}
            onChange={(value) => { setDateOfBirth(value); setLocalError(null); }}
            error={localError ?? undefined}
          />
          <Text style={[styles.privacy, { color: colors.textSecondary }]}>
            Your date of birth is private. Self-declaration does not replace identity verification.
          </Text>
          {gate.error ? (
            <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>
              {gate.error}
            </Text>
          ) : null}
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Confirm I am 18 or older"
            accessibilityState={{ disabled: busy }}
            style={[styles.button, { backgroundColor: colors.actionPrimary }]}
            onPress={submit}
            disabled={busy}
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Confirm and continue</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Recheck age eligibility"
            style={styles.secondaryButton}
            onPress={retry}
            disabled={busy}
          >
            <Text style={[styles.secondaryText, { color: colors.actionPrimary }]}>Recheck status</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {phase === 'error' ? (
        <View style={styles.form}>
          <Text accessibilityLiveRegion="polite" style={[styles.error, { color: colors.danger }]}>
            {gate.error ?? 'Your age eligibility could not be checked. Please retry.'}
          </Text>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Retry age eligibility check"
            style={[styles.button, { backgroundColor: colors.actionPrimary }]}
            onPress={retry}
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Sign out"
        accessibilityState={{ disabled: phase === 'completing' }}
        style={styles.secondaryButton}
        onPress={signOut}
        disabled={phase === 'completing'}
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
  label: { fontSize: fontSize.md, fontWeight: '600' },
  privacy: { fontSize: fontSize.sm, lineHeight: 20 },
  error: { fontSize: fontSize.sm, lineHeight: 20 },
  loading: { minHeight: 96, alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  button: { borderRadius: radius.md, minHeight: 52, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  buttonText: { fontSize: fontSize.md, fontWeight: '600' },
  secondaryButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontSize: fontSize.md, fontWeight: '500' },
});
