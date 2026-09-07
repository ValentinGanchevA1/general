import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AccountStackParamList } from '@/navigation/stacks';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateProfile } from '@/features/profile/profileSlice';
import { openRootScreen } from '@/navigation/openRootScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FormField } from '@/components/FormField';
import { useFieldErrors } from '@/hooks/useFieldErrors';
import { colors, fontSize, spacing, radius } from '@/theme';

type Nav = NativeStackNavigationProp<AccountStackParamList>;
type FieldKey = 'displayName' | 'dateOfBirth' | 'hometownCity' | 'hometownCountry';

function isAdult(isoDate: string): boolean {
  const dob = new Date(isoDate);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) years -= 1;
  return years >= 18;
}

export function ProfileEditScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.profile);
  const loading = useAppSelector((s) => s.profile.loading);
  const error = useAppSelector((s) => s.profile.error);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '');
  const [hometownCity, setHometownCity] = useState(profile?.hometownCity ?? '');
  const [hometownCountry, setHometownCountry] = useState(profile?.hometownCountry ?? '');
  const [showAge, setShowAge] = useState(profile?.showAge ?? true);
  const [showHometown, setShowHometown] = useState(profile?.showHometown ?? true);

  const { errors, setErrors, clear } = useFieldErrors<FieldKey>();

  const bioRef = useRef<TextInput>(null);
  const dobRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);

  const save = async (): Promise<void> => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!displayName.trim()) {
      next.displayName = 'Display name is required.';
    }
    const dob = dateOfBirth.trim();
    if (dob && !isAdult(dob)) {
      next.dateOfBirth = 'You must be at least 18 years old.';
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    const result = await dispatch(
      updateProfile({
        displayName: displayName.trim(),
        bio: bio.trim(),
        dateOfBirth: dob || null,
        hometownCity: hometownCity.trim() || null,
        hometownCountry: hometownCountry.trim() || null,
        showAge,
        showHometown,
      }),
    );
    if (updateProfile.fulfilled.match(result)) {
      navigation.goBack();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader
        title="Edit profile"
        bordered
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity
            onPress={() => { void save(); }}
            disabled={loading}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Save profile"
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.saveLink}>Save</Text>
            )}
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <FormField
          label="Display name"
          value={displayName}
          onChangeText={(t) => {
            setDisplayName(t);
            clear('displayName');
          }}
          placeholder="Your name"
          maxLength={50}
          returnKeyType="next"
          onSubmitEditing={() => bioRef.current?.focus()}
          error={errors.displayName}
          testID="profile-edit-display-name"
        />

        <FormField
          ref={bioRef}
          label="Bio"
          value={bio}
          onChangeText={setBio}
          placeholder="A short intro"
          multiline
          maxLength={160}
          style={styles.bioInput}
          returnKeyType="next"
          onSubmitEditing={() => dobRef.current?.focus()}
          testID="profile-edit-bio"
        />
        <Text style={styles.charCount}>{bio.length}/160</Text>

        <Text style={styles.section}>ORIGIN</Text>
        <FormField
          ref={dobRef}
          label="Date of birth (YYYY-MM-DD)"
          value={dateOfBirth}
          onChangeText={(t) => {
            setDateOfBirth(t);
            clear('dateOfBirth');
          }}
          placeholder="1990-01-15"
          autoCapitalize="none"
          returnKeyType="next"
          onSubmitEditing={() => cityRef.current?.focus()}
          error={errors.dateOfBirth}
          testID="profile-edit-dob"
        />
        <Text style={styles.hint}>Used for age only. Must be 18+.</Text>

        <FormField
          ref={cityRef}
          label="City"
          value={hometownCity}
          onChangeText={setHometownCity}
          placeholder="Varna"
          returnKeyType="next"
          onSubmitEditing={() => countryRef.current?.focus()}
          testID="profile-edit-city"
        />

        <FormField
          ref={countryRef}
          label="Country"
          value={hometownCountry}
          onChangeText={setHometownCountry}
          placeholder="BG"
          autoCapitalize="characters"
          maxLength={40}
          returnKeyType="done"
          testID="profile-edit-country"
        />

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Show age on profile</Text>
            <Text style={styles.toggleSub}>Others see age next to your name</Text>
          </View>
          <Switch
            value={showAge}
            onValueChange={setShowAge}
            trackColor={{ false: colors.borderStrong, true: 'rgba(0,212,255,0.35)' }}
            thumbColor={showAge ? colors.primary : colors.textFaint}
          />
        </View>

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Show place of origin</Text>
            <Text style={styles.toggleSub}>City and country on your public profile</Text>
          </View>
          <Switch
            value={showHometown}
            onValueChange={setShowHometown}
            trackColor={{ false: colors.borderStrong, true: 'rgba(0,212,255,0.35)' }}
            thumbColor={showHometown ? colors.primary : colors.textFaint}
          />
        </View>

        <Text style={styles.section}>PHONE</Text>
        <Text style={styles.hint}>
          {profile?.phone
            ? profile.badges?.phone
              ? 'Verified — you can change it anytime (re-verification required).'
              : 'Saved but not verified yet. Confirm with a code to unlock Phone trust.'
            : 'Add a number and verify it to show Phone ✓ on your profile.'}
        </Text>
        <View style={styles.phoneRow}>
          <Text style={[styles.phoneText, !profile?.phone && styles.phoneMuted]}>
            {profile?.phone ?? 'No phone on file'}
          </Text>
          <TouchableOpacity
            style={styles.phoneBtn}
            onPress={() =>
              openRootScreen(navigation, 'Verification', {
                initialPhone: profile?.phone ?? undefined,
              })
            }
          >
            <Text style={styles.phoneBtnText}>
              {profile?.phone ? (profile.badges?.phone ? 'Change' : 'Verify') : 'Add phone'}
            </Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={() => { void save(); }} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.btnText}>Save</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  saveLink: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
  scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 48 },
  section: {
    color: colors.primary,
    fontSize: fontSize.sm,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: spacing.md,
    marginBottom: 4,
  },
  bioInput: { minHeight: 100, textAlignVertical: 'top' as const },
  charCount: { color: colors.textFaint, fontSize: fontSize.xs, textAlign: 'right' },
  hint: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 14,
    marginTop: spacing.sm,
    gap: 12,
  },
  toggleText: { flex: 1 },
  toggleLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  toggleSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    gap: 12,
  },
  phoneText: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md },
  phoneMuted: { color: colors.textFaint },
  phoneBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(0,212,255,0.15)',
  },
  phoneBtnText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
  error: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.sm },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  btnText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  cancelBtn: { alignItems: 'center', padding: 12 },
  cancelText: { color: colors.textMuted, fontSize: fontSize.sm },
});
