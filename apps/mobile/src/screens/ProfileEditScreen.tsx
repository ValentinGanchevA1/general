import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { Gender, SexualOrientation } from '@g88/shared';
import {
  GENDERS,
  GENDER_LABELS,
  ORIENTATION_LABELS,
  SEXUAL_ORIENTATIONS,
} from '@g88/shared';
import type { AccountStackParamList } from '@/navigation/stacks';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { INTEREST_OPTIONS } from '@/features/profile/interestOptions';
import { PURPOSE_OPTIONS } from '@/features/profile/goalOptions';
import { updateProfile } from '@/features/profile/profileSlice';
import { openRootScreen } from '@/navigation/openRootScreen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FormField } from '@/components/FormField';
import { useFieldErrors } from '@/hooks/useFieldErrors';
import { fontSize, spacing, radius, useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<AccountStackParamList>;
type EditRoute = RouteProp<AccountStackParamList, 'ProfileEdit'>;
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

function ChipRow<T extends string>({ options, labels, value, onChange }: {
  options: readonly T[];
  labels: Record<T, string>;
  value: T | null;
  onChange: (v: T | null) => void;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const selected = value === opt;
        return (
          <TouchableOpacity
            key={opt}
            style={[styles.chip, selected ? styles.chipOn : undefined]}
            onPress={() => onChange(selected ? null : opt)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.chipText, selected ? styles.chipTextOn : undefined]}>{labels[opt]}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MultiSelectOptions({
  options,
  selected,
  onToggle,
}: {
  options: ReadonlyArray<{ value: string; label: string; icon: string }>;
  selected: string[];
  onToggle: (value: string) => void;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.choiceGrid}>
      {options.map((option) => {
        const on = selected.includes(option.value);
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.choiceChip, on && styles.choiceChipOn]}
            onPress={() => onToggle(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Text style={styles.choiceIcon}>{option.icon}</Text>
            <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{option.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function ProfileEditScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.profile);
  const loading = useAppSelector((s) => s.profile.loading);
  const error = useAppSelector((s) => s.profile.error);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [occupation, setOccupation] = useState(profile?.occupation ?? '');
  const [showOccupation, setShowOccupation] = useState(profile?.showOccupation ?? true);
  const [interests, setInterests] = useState<string[]>(profile?.interests ?? []);
  const [goals, setGoals] = useState<string[]>(profile?.goals ?? []);
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth ?? '');
  const [hometownCity, setHometownCity] = useState(profile?.hometownCity ?? '');
  const [hometownCountry, setHometownCountry] = useState(profile?.hometownCountry ?? '');
  const [showAge, setShowAge] = useState(profile?.showAge ?? true);
  const [showHometown, setShowHometown] = useState(profile?.showHometown ?? true);
  const [gender, setGender] = useState<Gender | null>(profile?.gender ?? null);
  const [genderSelfDescribe, setGenderSelfDescribe] = useState(profile?.genderSelfDescribe ?? '');
  const [sexualOrientation, setSexualOrientation] = useState<SexualOrientation | null>(profile?.sexualOrientation ?? null);
  const [orientationSelfDescribe, setOrientationSelfDescribe] = useState(profile?.orientationSelfDescribe ?? '');
  const [nationality, setNationality] = useState(profile?.nationality ?? '');
  const [showGender, setShowGender] = useState(profile?.showGender ?? true);
  const [showOrientation, setShowOrientation] = useState(profile?.showOrientation ?? false);
  const [showNationality, setShowNationality] = useState(profile?.showNationality ?? true);
  const [openToDating, setOpenToDating] = useState(profile?.openToDating ?? false);
  const [seekingGenders, setSeekingGenders] = useState<Gender[]>(profile?.seekingGenders ?? []);
  const { errors, setErrors, clear } = useFieldErrors<FieldKey>();
  const bioRef = useRef<TextInput>(null);
  const dobRef = useRef<TextInput>(null);
  const cityRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const datingYRef = useRef(0);
  const route = useRoute<EditRoute>();
  const focus = route.params?.focus;
  const switchTrack = { false: colors.borderStrong, true: colors.primaryTrack };

  useEffect(() => {
    if (focus !== 'dating') return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, datingYRef.current - 16), animated: true });
    }, 120);
    return () => clearTimeout(t);
  }, [focus]);

  const toggle = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string): void => {
    setter((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
  };

  const save = async (): Promise<void> => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!displayName.trim()) next.displayName = 'Display name is required.';
    const dob = dateOfBirth.trim();
    if (dob && !isAdult(dob)) next.dateOfBirth = 'You must be at least 18 years old.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setErrors({});
    const result = await dispatch(updateProfile({
      displayName: displayName.trim(),
      bio: bio.trim(),
      occupation: occupation.trim() || null,
      showOccupation,
      interests,
      goals,
      dateOfBirth: dob || null,
      hometownCity: hometownCity.trim() || null,
      hometownCountry: hometownCountry.trim() || null,
      showAge,
      showHometown,
      gender,
      genderSelfDescribe: gender === 'self_describe' ? genderSelfDescribe.trim() || null : null,
      sexualOrientation,
      orientationSelfDescribe: sexualOrientation === 'self_describe' ? orientationSelfDescribe.trim() || null : null,
      nationality: nationality.trim() || null,
      showGender,
      showOrientation,
      showNationality,
      openToDating,
      seekingGenders,
    }));
    if (updateProfile.fulfilled.match(result)) navigation.goBack();
  };

  const themedSwitch = (value: boolean, onValueChange: (value: boolean) => void): React.JSX.Element => (
    <Switch value={value} onValueChange={onValueChange} trackColor={switchTrack} thumbColor={value ? colors.primary : colors.textFaint} />
  );

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScreenHeader
        title="Edit profile"
        bordered
        onBack={() => navigation.goBack()}
        right={
          <TouchableOpacity onPress={() => { void save(); }} disabled={loading} hitSlop={8} accessibilityRole="button" accessibilityLabel="Save profile">
            {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.saveLink}>Save</Text>}
          </TouchableOpacity>
        }
      />

      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>PROFILE</Text>
        <FormField label="Display name" value={displayName} onChangeText={(t) => { setDisplayName(t); clear('displayName'); }} placeholder="Your name" maxLength={50} returnKeyType="next" onSubmitEditing={() => bioRef.current?.focus()} error={errors.displayName} testID="profile-edit-display-name" />
        <FormField ref={bioRef} label="Bio" value={bio} onChangeText={setBio} placeholder="A short intro" multiline maxLength={160} style={styles.bioInput} returnKeyType="next" onSubmitEditing={() => dobRef.current?.focus()} testID="profile-edit-bio" />
        <Text style={styles.charCount}>{bio.length}/160</Text>

        <Text style={styles.section}>INTERESTS</Text>
        <Text style={styles.hint}>What you enjoy. Shared interests power suggestions and matching signals.</Text>
        <MultiSelectOptions options={INTEREST_OPTIONS} selected={interests} onToggle={(value) => toggle(setInterests, value)} />

        <Text style={styles.section}>PURPOSE</Text>
        <Text style={styles.hint}>Your core reasons for using NEXA. Stored in the existing goals field for compatibility.</Text>
        <MultiSelectOptions options={PURPOSE_OPTIONS} selected={goals} onToggle={(value) => toggle(setGoals, value)} />

        <Text style={styles.section}>ORIGIN</Text>
        <FormField ref={dobRef} label="Date of birth (YYYY-MM-DD)" value={dateOfBirth} onChangeText={(t) => { setDateOfBirth(t); clear('dateOfBirth'); }} placeholder="1990-01-15" autoCapitalize="none" returnKeyType="next" onSubmitEditing={() => cityRef.current?.focus()} error={errors.dateOfBirth} testID="profile-edit-dob" />
        <Text style={styles.hint}>Private exact date; used for age and zodiac. Must be 18+.</Text>
        <FormField ref={cityRef} label="From" value={hometownCity} onChangeText={setHometownCity} placeholder="Varna" returnKeyType="next" onSubmitEditing={() => countryRef.current?.focus()} testID="profile-edit-city" />
        <FormField ref={countryRef} label="Country" value={hometownCountry} onChangeText={setHometownCountry} placeholder="BG" autoCapitalize="characters" maxLength={40} returnKeyType="done" testID="profile-edit-country" />
        <View style={styles.toggleRow}><View style={styles.toggleText}><Text style={styles.toggleLabel}>Show age on profile</Text><Text style={styles.toggleSub}>Others see age, not your exact birth date</Text></View>{themedSwitch(showAge, setShowAge)}</View>
        <View style={styles.toggleRow}><View style={styles.toggleText}><Text style={styles.toggleLabel}>Show where I’m from</Text><Text style={styles.toggleSub}>City and country on your public profile</Text></View>{themedSwitch(showHometown, setShowHometown)}</View>

        <Text style={styles.section}>ABOUT YOU</Text>
        <Text style={styles.hint}>Optional profile details. Visibility remains under your control.</Text>
        <FormField label="Occupation" value={occupation} onChangeText={setOccupation} placeholder="e.g. Software engineer" maxLength={80} testID="profile-edit-occupation" />
        <View style={styles.toggleRow}><View style={styles.toggleText}><Text style={styles.toggleLabel}>Show occupation on profile</Text><Text style={styles.toggleSub}>When off, your saved occupation stays private</Text></View>{themedSwitch(showOccupation, setShowOccupation)}</View>

        <Text style={styles.fieldLabel}>Gender</Text>
        <ChipRow options={GENDERS} labels={GENDER_LABELS} value={gender} onChange={setGender} />
        {gender === 'self_describe' ? <FormField label="Describe gender" value={genderSelfDescribe} onChangeText={setGenderSelfDescribe} placeholder="Your terms" maxLength={40} testID="profile-edit-gender-self" /> : null}
        <View style={styles.toggleRow}><View style={styles.toggleText}><Text style={styles.toggleLabel}>Show gender on profile</Text></View>{themedSwitch(showGender, setShowGender)}</View>

        <Text style={styles.fieldLabel}>Sexual orientation</Text>
        <ChipRow options={SEXUAL_ORIENTATIONS} labels={ORIENTATION_LABELS} value={sexualOrientation} onChange={setSexualOrientation} />
        {sexualOrientation === 'self_describe' ? <FormField label="Describe orientation" value={orientationSelfDescribe} onChangeText={setOrientationSelfDescribe} placeholder="Your terms" maxLength={40} testID="profile-edit-orientation-self" /> : null}
        <View style={styles.toggleRow}><View style={styles.toggleText}><Text style={styles.toggleLabel}>Show orientation on profile</Text><Text style={styles.toggleSub}>Off by default</Text></View>{themedSwitch(showOrientation, setShowOrientation)}</View>

        <FormField label="Nationality" value={nationality} onChangeText={setNationality} placeholder="BG" autoCapitalize="characters" maxLength={40} testID="profile-edit-nationality" />
        <View style={styles.toggleRow}><View style={styles.toggleText}><Text style={styles.toggleLabel}>Show nationality on profile</Text></View>{themedSwitch(showNationality, setShowNationality)}</View>

        <View onLayout={(e) => { datingYRef.current = e.nativeEvent.layout.y; }}>
          <Text style={styles.section}>DATING</Text>
          <Text style={styles.hint}>Opt in to appear when others use the Dating map filter. Seeking is private.</Text>
          <View style={styles.toggleRow}><View style={styles.toggleText}><Text style={styles.toggleLabel}>Open to dating</Text></View>{themedSwitch(openToDating, setOpenToDating)}</View>
          {openToDating ? <>
            <Text style={styles.fieldLabel}>Interested in</Text>
            <View style={styles.chipRow}>{GENDERS.filter((g) => g !== 'self_describe').map((g) => {
              const on = seekingGenders.includes(g);
              return <TouchableOpacity key={g} style={[styles.chip, on && styles.chipOn]} onPress={() => setSeekingGenders((prev) => on ? prev.filter((x) => x !== g) : [...prev, g])}><Text style={[styles.chipText, on && styles.chipTextOn]}>{GENDER_LABELS[g]}</Text></TouchableOpacity>;
            })}</View>
            <Text style={styles.hint}>Leave empty to match any gender.</Text>
          </> : null}
        </View>

        <Text style={styles.section}>PHONE</Text>
        <Text style={styles.hint}>{profile?.phone ? profile.badges?.phone ? 'Verified — changing it requires re-verification.' : 'Saved but not verified yet.' : 'Add and verify a phone number to strengthen trust.'}</Text>
        <View style={styles.phoneRow}>
          <Text style={[styles.phoneText, !profile?.phone && styles.phoneMuted]}>{profile?.phone ?? 'No phone on file'}</Text>
          <TouchableOpacity style={styles.phoneBtn} onPress={() => openRootScreen(navigation, 'Verification', { initialPhone: profile?.phone ?? undefined })}>
            <Text style={styles.phoneBtnText}>{profile?.phone ? (profile.badges?.phone ? 'Change' : 'Verify') : 'Add phone'}</Text>
          </TouchableOpacity>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.btn} onPress={() => { void save(); }} disabled={loading}>{loading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.btnText}>Save</Text>}</TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    saveLink: { color: colors.primary, fontSize: fontSize.md, fontWeight: '700' },
    scroll: { padding: spacing.lg, gap: spacing.sm, paddingBottom: 48 },
    section: { color: colors.primary, fontSize: fontSize.sm, fontWeight: '800', letterSpacing: 0.8, marginTop: spacing.lg, marginBottom: 4 },
    fieldLabel: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing.sm, marginBottom: 6 },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt },
    chipOn: { borderColor: colors.primary, backgroundColor: colors.primaryMutedBg },
    chipText: { color: colors.textPrimary, fontSize: fontSize.sm },
    chipTextOn: { color: colors.primary, fontWeight: '700' },
    choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    choiceChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 9, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt },
    choiceChipOn: { borderColor: colors.primary, backgroundColor: colors.primaryMutedBg },
    choiceIcon: { fontSize: 16 },
    choiceText: { color: colors.textPrimary, fontSize: fontSize.sm },
    choiceTextOn: { color: colors.primary, fontWeight: '700' },
    bioInput: { minHeight: 100, textAlignVertical: 'top' as const },
    charCount: { color: colors.textFaint, fontSize: fontSize.xs, textAlign: 'right' },
    hint: { color: colors.textFaint, fontSize: fontSize.xs, marginBottom: 4, lineHeight: 17 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 14, marginTop: spacing.sm, gap: 12 },
    toggleText: { flex: 1 },
    toggleLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
    toggleSub: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
    phoneRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 14, borderWidth: 1, borderColor: colors.borderStrong, gap: 12 },
    phoneText: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md },
    phoneMuted: { color: colors.textFaint },
    phoneBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.primaryMutedBg },
    phoneBtnText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.sm },
    error: { color: colors.danger, fontSize: fontSize.sm, marginTop: spacing.sm },
    btn: { minHeight: 52, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xl },
    btnText: { color: colors.onPrimary, fontWeight: '800', fontSize: fontSize.md },
    cancelBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
    cancelText: { color: colors.textMuted, fontSize: fontSize.sm },
  });
}
