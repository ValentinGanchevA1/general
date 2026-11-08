import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, AppState, KeyboardAvoidingView, Linking, Modal,
  Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { isAdultDateOfBirth } from '@g88/shared';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useAppTheme } from '@/theme';
import { SUPPORT_EMAIL } from '@/constants/app';
import { deleteAccount, logout } from './authSlice';
import { loadAdultAgeStatus } from './adultAgeSlice';
import { updateProfile } from '@/features/profile/profileSlice';

interface Props { userId: string }

/**
 * This is a *recovery / eligibility* screen, not authorization.
 * All protected HTTP and WebSocket operations are independently checked by the
 * backend when NEXUS_REQUIRE_ADULT_AGE=true.
 */
export function AdultEligibilityGate({ userId }: Props): React.JSX.Element | null {
  const dispatch = useAppDispatch();
  const { colors } = useAppTheme();
  const state = useAppSelector(s => s.adultAge);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [password, setPassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(loadAdultAgeStatus(userId));
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') void dispatch(loadAdultAgeStatus(userId));
    });
    return () => subscription.remove();
  }, [dispatch, userId]);

  const status = state.userId === userId ? state.status : null;
  if (status?.enforced === false || status?.eligible === true) return null;

  const save = async (): Promise<void> => {
    if (saving) return;
    if (!isAdultDateOfBirth(dateOfBirth)) {
      setLocalError('Enter a valid date of birth. NEXUS is only available to adults.');
      return;
    }
    setSaving(true);
    setLocalError(null);
    const result = await dispatch(updateProfile({ dateOfBirth }));
    if (updateProfile.fulfilled.match(result)) {
      await dispatch(loadAdultAgeStatus(userId));
    } else {
      setLocalError('Could not verify your eligibility. Please retry.');
    }
    setSaving(false);
  };

  const confirmDelete = (): void => {
    Alert.alert('Delete account?', 'This permanently deletes your NEXUS account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => { void (async () => {
        setDeleting(true);
        const result = await dispatch(deleteAccount(password.trim() ? { password: password.trim() } : {}));
        if (deleteAccount.rejected.match(result)) {
          setLocalError(typeof result.payload === 'string' ? result.payload : 'Could not delete account.');
        }
        setDeleting(false);
      })(); } },
    ]);
  };

  const isMissingDob = status?.reason !== 'underage';
  return (
    <Modal visible onRequestClose={() => undefined} animationType="fade" statusBarTranslucent>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.root, { backgroundColor: colors.bg }]}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.brand, { color: colors.textPrimary }]}>NEXUS</Text>
          <Text accessibilityRole="header" style={[styles.heading, { color: colors.textPrimary }]}>
            Adult-only access
          </Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>
            NEXUS is available to adults aged 18 or older. We need to confirm age
            eligibility before map discovery, messaging, events or listings.
          </Text>
          {status === null && !state.error ? <ActivityIndicator color={colors.primary} /> : null}
          {state.error ? (
            <>
              <Text accessibilityRole="alert" style={styles.error}>Could not check eligibility: {state.error}</Text>
              <TouchableOpacity
                onPress={() => { void dispatch(loadAdultAgeStatus(userId)); }}
                accessibilityRole="button" style={[styles.button, { backgroundColor: colors.primary }]}
              ><Text style={styles.buttonLabel}>Retry age check</Text></TouchableOpacity>
            </>
          ) : null}
          {status?.enforced && isMissingDob ? (
            <>
              <Text style={[styles.description, { color: colors.textSecondary }]}>
                Enter your actual date of birth (YYYY-MM-DD). This date is private.
              </Text>
              <TextInput
                style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                value={dateOfBirth}
                onChangeText={value => { setDateOfBirth(value); setLocalError(null); }}
                maxLength={10}
                autoCapitalize="none"
                accessibilityLabel="Date of birth"
              />
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.primary, opacity: saving ? 0.5 : 1 }]}
                disabled={saving}
                onPress={() => { void save(); }}
                accessibilityRole="button"
              ><Text style={styles.buttonLabel}>{saving ? 'Checking…' : 'Confirm age eligibility'}</Text></TouchableOpacity>
            </>
          ) : null}
          {status?.reason === 'underage' ? (
            <Text accessibilityRole="alert" style={[styles.description, { color: colors.textSecondary }]}>
              This account cannot access NEXUS. If this date is incorrect, contact support
              for an age-review process; changing your declared age does not verify identity.
            </Text>
          ) : null}
          {localError ? <Text accessibilityRole="alert" style={styles.error}>{localError}</Text> : null}
          <TouchableOpacity onPress={() => { void dispatch(logout()); }}
            accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={[styles.secondaryText, { color: colors.textPrimary }]}>Sign out</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { void Linking.openURL(`mailto:${SUPPORT_EMAIL}`); }}
            accessibilityRole="link" style={styles.secondaryButton}>
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Contact support</Text>
          </TouchableOpacity>
          <TextInput style={[styles.input, { color: colors.textPrimary, borderColor: colors.border }]}
            value={password} onChangeText={setPassword} secureTextEntry
            placeholder="Password (only if needed for account deletion)"
            placeholderTextColor={colors.textSecondary} accessibilityLabel="Deletion password" />
          <TouchableOpacity onPress={confirmDelete} disabled={deleting}
            accessibilityRole="button" style={styles.secondaryButton}>
            <Text style={[styles.secondaryText, { color: colors.danger }]}>
              {deleting ? 'Deleting account…' : 'Delete my account'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 18 },
  brand: { textAlign: 'center', fontSize: 24, fontWeight: '900', letterSpacing: 3 },
  heading: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 15, lineHeight: 23, textAlign: 'center' },
  input: { borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 16 },
  button: { minHeight: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', padding: 12 },
  buttonLabel: { fontWeight: '800', fontSize: 16, color: '#FFFFFF' },
  secondaryButton: { paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  secondaryText: { fontSize: 15, textAlign: 'center' },
  error: { color: '#E23B48', textAlign: 'center', fontSize: 14 },
});
