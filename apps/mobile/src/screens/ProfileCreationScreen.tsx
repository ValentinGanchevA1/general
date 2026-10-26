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
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { BrandLogo } from '@/components/Brand/BrandLogo';
import { NexaDiscoveryHero } from '@/components/Brand/NexaDiscoveryHero';
import { FormField } from '@/components/FormField';
import { INTEREST_OPTIONS } from '@/features/profile/interestOptions';
import { PURPOSE_OPTIONS } from '@/features/profile/goalOptions';
import { updateProfile } from '@/features/profile/profileSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

const TOTAL_STEPS = 5;
const MIN_INTERESTS = 3;

interface OnboardingState {
  displayName: string;
  interests: string[];
  dateOfBirth: string;
  hometownCity: string;
  hometownCountry: string;
  showAge: boolean;
  showHometown: boolean;
  /** Persisted as `goals`; surfaced to users as Purpose. */
  goals: string[];
  visibility: 'public' | 'private';
}

interface StepHeaderProps {
  eyebrow: string;
  title: string;
  subtitle: string;
}

function StepHeader({ eyebrow, title, subtitle }: StepHeaderProps): React.JSX.Element {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stepHeader}>
      <Text style={[styles.stepEyebrow, { color: colors.discovery }]}>{eyebrow}</Text>
      <Text style={[styles.stepHeading, { color: colors.textPrimary }]}>{title}</Text>
      <Text style={[styles.stepSub, { color: colors.textTertiary }]}>{subtitle}</Text>
    </View>
  );
}

function isAdult(isoDate: string): boolean {
  const dob = new Date(isoDate);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  const monthDelta = today.getMonth() - dob.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) years -= 1;
  return years >= 18;
}

function StepName({ value, onChange }: { value: string; onChange: (value: string) => void }): React.JSX.Element {
  return (
    <View style={styles.stepBody}>
      <StepHeader
        eyebrow="IDENTITY"
        title="How should people know you?"
        subtitle="This name appears with your profile across NEXA."
      />
      <FormField
        value={value}
        onChangeText={onChange}
        placeholder="Your name"
        autoCapitalize="words"
        autoFocus
        maxLength={40}
        testID="onboarding-display-name"
      />
    </View>
  );
}

function SelectableGrid({
  options,
  selected,
  onToggle,
  tone,
}: {
  options: ReadonlyArray<{ value: string; label: string; icon: string }>;
  selected: string[];
  onToggle: (value: string) => void;
  tone: 'interest' | 'purpose';
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const activeBackground = tone === 'interest' ? colors.discoverySoft : colors.actionSoft;
  const activeBorder = tone === 'interest' ? colors.discovery : colors.actionPrimary;

  return (
    <View style={styles.choiceGrid}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.choiceChip,
              {
                backgroundColor: active ? activeBackground : colors.surfaceSecondary,
                borderColor: active ? activeBorder : colors.borderDefault,
              },
            ]}
            onPress={() => onToggle(option.value)}
            activeOpacity={0.72}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option.label}
          >
            <Text style={styles.choiceIcon}>{option.icon}</Text>
            <Text
              numberOfLines={1}
              style={[
                styles.choiceLabel,
                { color: active ? activeBorder : colors.textSecondary },
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StepInterests({ selected, onToggle }: { selected: string[]; onToggle: (value: string) => void }): React.JSX.Element {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stepBody}>
      <StepHeader
        eyebrow="INTERESTS"
        title="What are you into?"
        subtitle="Pick at least 3. Shared interests help NEXA find better people, activities and conversations for you."
      />
      <SelectableGrid options={INTEREST_OPTIONS} selected={selected} onToggle={onToggle} tone="interest" />
      <Text style={[styles.selectionCount, { color: colors.textTertiary }]}>
        {selected.length} selected · minimum {MIN_INTERESTS}
      </Text>
    </View>
  );
}

function StepOrigin({
  dateOfBirth,
  hometownCity,
  hometownCountry,
  showAge,
  showHometown,
  onChange,
  error,
}: {
  dateOfBirth: string;
  hometownCity: string;
  hometownCountry: string;
  showAge: boolean;
  showHometown: boolean;
  onChange: (patch: Partial<OnboardingState>) => void;
  error: string;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  const cityRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);

  return (
    <View style={styles.stepBody}>
      <StepHeader
        eyebrow="ABOUT YOU"
        title="Age & origin"
        subtitle="You must be 18+. Exact date of birth stays private; NEXA can derive your age and zodiac from it."
      />
      <FormField
        label="Date of birth"
        value={dateOfBirth}
        onChangeText={(value) => onChange({ dateOfBirth: value })}
        placeholder="YYYY-MM-DD"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        autoCapitalize="none"
        returnKeyType="next"
        onSubmitEditing={() => cityRef.current?.focus()}
        error={error || undefined}
        testID="onboarding-dob"
      />
      <FormField
        ref={cityRef}
        label="From"
        value={hometownCity}
        onChangeText={(value) => onChange({ hometownCity: value })}
        placeholder="e.g. Varna"
        autoCapitalize="words"
        maxLength={80}
        returnKeyType="next"
        onSubmitEditing={() => countryRef.current?.focus()}
        testID="onboarding-city"
      />
      <FormField
        ref={countryRef}
        label="Country"
        value={hometownCountry}
        onChangeText={(value) => onChange({ hometownCountry: value })}
        placeholder="e.g. BG"
        autoCapitalize="characters"
        maxLength={40}
        returnKeyType="done"
        testID="onboarding-country"
      />
      <View style={[styles.toggleRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderDefault }]}>
        <View style={styles.toggleCopy}>
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Show age</Text>
          <Text style={[styles.toggleHint, { color: colors.textTertiary }]}>Others see age, never your exact birth date</Text>
        </View>
        <Switch
          value={showAge}
          onValueChange={(value) => onChange({ showAge: value })}
          trackColor={{ false: colors.borderStrong, true: colors.actionBorder }}
          thumbColor={showAge ? colors.actionPrimary : colors.textTertiary}
        />
      </View>
      <View style={[styles.toggleRow, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderDefault }]}>
        <View style={styles.toggleCopy}>
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Show where I’m from</Text>
          <Text style={[styles.toggleHint, { color: colors.textTertiary }]}>City and country on your public profile</Text>
        </View>
        <Switch
          value={showHometown}
          onValueChange={(value) => onChange({ showHometown: value })}
          trackColor={{ false: colors.borderStrong, true: colors.actionBorder }}
          thumbColor={showHometown ? colors.actionPrimary : colors.textTertiary}
        />
      </View>
    </View>
  );
}

function StepPurpose({ selected, onToggle }: { selected: string[]; onToggle: (value: string) => void }): React.JSX.Element {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stepBody}>
      <StepHeader
        eyebrow="PURPOSE"
        title="Why are you here?"
        subtitle="Choose your core reasons for using NEXA. Purpose helps shape discovery without replacing your interests."
      />
      <SelectableGrid options={PURPOSE_OPTIONS} selected={selected} onToggle={onToggle} tone="purpose" />
      <Text style={[styles.selectionCount, { color: colors.textTertiary }]}>
        Choose at least one. You can change your Purpose later.
      </Text>
    </View>
  );
}

function StepVisibility({ value, onChange }: { value: 'public' | 'private'; onChange: (value: 'public' | 'private') => void }): React.JSX.Element {
  const { colors } = useAppTheme();
  const optionStyle = (selected: boolean) => ({
    backgroundColor: selected ? colors.discoverySoft : colors.surfaceSecondary,
    borderColor: selected ? colors.discovery : colors.borderDefault,
  });

  return (
    <View style={styles.stepBody}>
      <StepHeader
        eyebrow="MAP VISIBILITY"
        title="Choose how you appear on the map."
        subtitle="Visibility can be changed any time in Settings."
      />
      <TouchableOpacity
        style={[styles.visibilityCard, optionStyle(value === 'public')]}
        onPress={() => onChange('public')}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'public' }}
      >
        <View style={[styles.visibilityIcon, { backgroundColor: colors.discoveryMutedBg }]}>
          <Icon name="map-marker-radius-outline" size={24} color={colors.discovery} />
        </View>
        <View style={styles.visibilityText}>
          <Text style={[styles.visibilityTitle, { color: value === 'public' ? colors.discovery : colors.textPrimary }]}>Discoverable</Text>
          <Text style={[styles.visibilitySub, { color: colors.textTertiary }]}>Nearby people can find your profile on the map</Text>
        </View>
        {value === 'public' ? <Icon name="check-circle" size={21} color={colors.discovery} /> : null}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.visibilityCard, optionStyle(value === 'private')]}
        onPress={() => onChange('private')}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'private' }}
      >
        <View style={[styles.visibilityIcon, { backgroundColor: colors.actionSoft }]}>
          <Icon name="eye-off-outline" size={24} color={colors.actionPrimary} />
        </View>
        <View style={styles.visibilityText}>
          <Text style={[styles.visibilityTitle, { color: value === 'private' ? colors.actionPrimary : colors.textPrimary }]}>Private browsing</Text>
          <Text style={[styles.visibilitySub, { color: colors.textTertiary }]}>Explore the map without being shown to others</Text>
        </View>
        {value === 'private' ? <Icon name="check-circle" size={21} color={colors.actionPrimary} /> : null}
      </TouchableOpacity>
    </View>
  );
}

export function ProfileCreationScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const { loading, error } = useAppSelector((state) => state.profile);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingState>({
    displayName: authUser?.displayName ?? '',
    interests: [],
    dateOfBirth: '',
    hometownCity: '',
    hometownCountry: '',
    showAge: true,
    showHometown: true,
    goals: [],
    visibility: 'public',
  });
  const [originError, setOriginError] = useState('');

  const toggleArrayValue = (key: 'interests' | 'goals', value: string): void => {
    setForm((current) => ({
      ...current,
      [key]: current[key].includes(value)
        ? current[key].filter((item) => item !== value)
        : [...current[key], value],
    }));
  };

  const canAdvance = (): boolean => {
    if (step === 1) return form.displayName.trim().length > 0;
    if (step === 2) return form.interests.length >= MIN_INTERESTS;
    if (step === 3) {
      const dob = form.dateOfBirth.trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(dob) && isAdult(dob);
    }
    if (step === 4) return form.goals.length > 0;
    return true;
  };

  const advance = (): void => {
    if (step === 3) {
      const dob = form.dateOfBirth.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        setOriginError('Enter date of birth as YYYY-MM-DD');
        return;
      }
      if (!isAdult(dob)) {
        setOriginError('You must be at least 18 years old');
        return;
      }
      setOriginError('');
    }

    if (step < TOTAL_STEPS) {
      setStep((current) => current + 1);
      return;
    }

    void dispatch(
      updateProfile({
        displayName: form.displayName.trim(),
        // Legacy completion currently relies on bio being non-null. Bio authoring moves to Profile v3.
        bio: '',
        interests: form.interests,
        dateOfBirth: form.dateOfBirth.trim(),
        hometownCity: form.hometownCity.trim() || null,
        hometownCountry: form.hometownCountry.trim() || null,
        showAge: form.showAge,
        showHometown: form.showHometown,
        goals: form.goals,
        visibility: form.visibility,
      }),
    );
  };

  if (step === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.canvas }]}>
        <ScrollView contentContainerStyle={styles.welcomeBody} showsVerticalScrollIndicator={false}>
          <BrandLogo size={72} />
          <Text style={[styles.welcomeEyebrow, { color: colors.discovery }]}>YOUR LOCAL WORLD</Text>
          <NexaDiscoveryHero />
          <Text style={[styles.welcomeHeading, { color: colors.textPrimary }]}>Make the map yours.</Text>
          <Text style={[styles.welcomeSub, { color: colors.textSecondary }]}>Tell NEXA what you like, why you’re here, and how you want to appear nearby.</Text>
        </ScrollView>
        <View style={[styles.welcomeFooter, { backgroundColor: colors.canvas, borderTopColor: colors.borderSubtle }]}>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }]} onPress={() => setStep(1)} activeOpacity={0.82} accessibilityRole="button">
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Set up my profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLastStep = step === TOTAL_STEPS;
  const allowAdvance = canAdvance();

  return (
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.canvas }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.progressWrap} accessible accessibilityLabel={`Profile setup step ${step} of ${TOTAL_STEPS}`}>
        <View style={styles.progressHeader}>
          <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>PROFILE SETUP</Text>
          <Text style={[styles.progressCount, { color: colors.discovery }]}>{step}/{TOTAL_STEPS}</Text>
        </View>
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <View key={index} style={[styles.progressSegment, { backgroundColor: index < step ? colors.discovery : colors.borderSubtle }]} />
          ))}
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {step === 1 ? <StepName value={form.displayName} onChange={(displayName) => setForm((current) => ({ ...current, displayName }))} /> : null}
        {step === 2 ? <StepInterests selected={form.interests} onToggle={(value) => toggleArrayValue('interests', value)} /> : null}
        {step === 3 ? <StepOrigin dateOfBirth={form.dateOfBirth} hometownCity={form.hometownCity} hometownCountry={form.hometownCountry} showAge={form.showAge} showHometown={form.showHometown} error={originError} onChange={(patch) => setForm((current) => ({ ...current, ...patch }))} /> : null}
        {step === 4 ? <StepPurpose selected={form.goals} onToggle={(value) => toggleArrayValue('goals', value)} /> : null}
        {step === 5 ? <StepVisibility value={form.visibility} onChange={(visibility) => setForm((current) => ({ ...current, visibility }))} /> : null}
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.canvas, borderTopColor: colors.borderSubtle }]}>
        <TouchableOpacity style={[styles.backButton, { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderSubtle }]} onPress={() => setStep((current) => Math.max(0, current - 1))} activeOpacity={0.8}>
          <Icon name="arrow-left" size={24} color={colors.textSecondary} />
          <Text style={[styles.backText, { color: colors.textSecondary }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, { backgroundColor: colors.actionPrimary, opacity: allowAdvance && !loading ? 1 : 0.45 }]}
          onPress={advance}
          disabled={!allowAdvance || loading}
          activeOpacity={0.82}
        >
          {loading ? <ActivityIndicator color={colors.onPrimary} /> : <>
            <Text style={[styles.continueText, { color: colors.onPrimary }]}>{isLastStep ? 'Enter NEXA' : 'Continue'}</Text>
            <Icon name="arrow-right" size={24} color={colors.onPrimary} />
          </>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  welcomeBody: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: spacing.xl, paddingTop: 56, paddingBottom: 24 },
  welcomeEyebrow: { marginTop: spacing.xl, fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  welcomeHeading: { marginTop: spacing.xl, fontSize: 32, fontWeight: '800', letterSpacing: -0.7 },
  welcomeSub: { marginTop: spacing.sm, fontSize: fontSize.md, lineHeight: 23 },
  welcomeFooter: { padding: spacing.xl, borderTopWidth: StyleSheet.hairlineWidth },
  primaryButton: { minHeight: 56, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: fontSize.md, fontWeight: '800' },
  progressWrap: { paddingHorizontal: spacing.xl, paddingTop: 52, paddingBottom: spacing.lg },
  progressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  progressLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.6 },
  progressCount: { fontSize: 14, fontWeight: '800' },
  progressRow: { flexDirection: 'row', gap: 8 },
  progressSegment: { height: 4, flex: 1, borderRadius: 4 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingBottom: 32 },
  stepBody: { paddingTop: spacing.xl },
  stepHeader: { marginBottom: spacing.xl },
  stepEyebrow: { fontSize: 13, fontWeight: '800', letterSpacing: 1.4, marginBottom: 10 },
  stepHeading: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  stepSub: { marginTop: 10, fontSize: fontSize.md, lineHeight: 23 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceChip: { width: '48%', minHeight: 54, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  choiceIcon: { fontSize: 20 },
  choiceLabel: { flex: 1, fontSize: fontSize.md, fontWeight: '600' },
  selectionCount: { marginTop: spacing.md, fontSize: fontSize.sm },
  toggleRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: radius.md, padding: 14, marginTop: spacing.sm, gap: 12 },
  toggleCopy: { flex: 1 },
  toggleLabel: { fontSize: fontSize.md, fontWeight: '600' },
  toggleHint: { marginTop: 2, fontSize: fontSize.xs },
  visibilityCard: { minHeight: 86, borderWidth: 1, borderRadius: radius.lg, padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  visibilityIcon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  visibilityText: { flex: 1 },
  visibilityTitle: { fontSize: fontSize.md, fontWeight: '800' },
  visibilitySub: { marginTop: 3, fontSize: fontSize.sm, lineHeight: 19 },
  error: { marginTop: spacing.md, fontSize: fontSize.sm },
  footer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.xl, paddingVertical: 18, flexDirection: 'row', gap: 14 },
  backButton: { minHeight: 56, width: 112, borderWidth: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  backText: { fontSize: fontSize.md, fontWeight: '700' },
  continueButton: { minHeight: 56, flex: 1, borderRadius: radius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  continueText: { fontSize: fontSize.md, fontWeight: '800' },
});
