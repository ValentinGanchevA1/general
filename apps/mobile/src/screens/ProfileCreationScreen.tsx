import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  TextInput,
  View,
} from 'react-native';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateProfile } from '@/features/profile/profileSlice';
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';
import { FormField } from '@/components/FormField';
import { colors, fontSize, spacing, radius } from '@/theme';

const TOTAL_STEPS = 5;

interface OnboardingState {
  displayName: string;
  bio: string;
  dateOfBirth: string;
  hometownCity: string;
  hometownCountry: string;
  showAge: boolean;
  showHometown: boolean;
  goals: string[];
  visibility: 'public' | 'private';
}

function isAdult(isoDate: string): boolean {
  const dob = new Date(isoDate);
  if (Number.isNaN(dob.getTime())) return false;
  const today = new Date();
  let years = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) years -= 1;
  return years >= 18;
}

function StepName({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepHeading}>What should{'\n'}we call you?</Text>
      <Text style={styles.stepSub}>This is the name other users see on the map.</Text>
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

function StepBio({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepHeading}>Tell people{'\n'}about yourself</Text>
      <Text style={styles.stepSub}>A short bio helps others connect with you.</Text>
      <FormField
        value={value}
        onChangeText={onChange}
        placeholder="A short bio — what are you here for?"
        multiline
        autoFocus
        maxLength={160}
        textAlignVertical="top"
        style={styles.bioInput}
        testID="onboarding-bio"
      />
      <Text style={styles.charCount}>{value.length}/160</Text>
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
  const cityRef = useRef<TextInput>(null);
  const countryRef = useRef<TextInput>(null);
  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepHeading}>Age & origin</Text>
      <Text style={styles.stepSub}>
        You must be 18+. Others only see your age and place if you allow it.
      </Text>
      <FormField
        label="Date of birth"
        value={dateOfBirth}
        onChangeText={(v) => onChange({ dateOfBirth: v })}
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
        label="City of origin"
        value={hometownCity}
        onChangeText={(v) => onChange({ hometownCity: v })}
        placeholder="e.g. Sofia"
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
        onChangeText={(v) => onChange({ hometownCountry: v })}
        placeholder="e.g. BG"
        autoCapitalize="characters"
        maxLength={40}
        returnKeyType="done"
        testID="onboarding-country"
      />
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show age on profile</Text>
        <Switch
          value={showAge}
          onValueChange={(v) => onChange({ showAge: v })}
          trackColor={{ false: colors.borderStrong, true: 'rgba(0,212,255,0.35)' }}
          thumbColor={showAge ? colors.primary : colors.textFaint}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show place of origin</Text>
        <Switch
          value={showHometown}
          onValueChange={(v) => onChange({ showHometown: v })}
          trackColor={{ false: colors.borderStrong, true: 'rgba(0,212,255,0.35)' }}
          thumbColor={showHometown ? colors.primary : colors.textFaint}
        />
      </View>
    </View>
  );
}

function StepGoals({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (v: string) => void;
}): React.JSX.Element {
  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepHeading}>What are you{'\n'}here for?</Text>
      <Text style={styles.stepSub}>Pick everything that fits. You can change this later.</Text>
      <View style={styles.goalsGrid}>
        {GOAL_OPTIONS.map((g) => {
          const active = selected.includes(g.value);
          return (
            <TouchableOpacity
              key={g.value}
              style={[styles.goalChip, active && styles.goalChipActive]}
              onPress={() => onToggle(g.value)}
              activeOpacity={0.7}
            >
              <Text style={styles.goalIcon}>{g.icon}</Text>
              <Text style={[styles.goalLabel, active && styles.goalLabelActive]}>{g.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function StepVisibility({
  value,
  onChange,
}: {
  value: 'public' | 'private';
  onChange: (v: 'public' | 'private') => void;
}): React.JSX.Element {
  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepHeading}>How visible{'\n'}are you?</Text>
      <Text style={styles.stepSub}>You can toggle this any time in Settings.</Text>
      <TouchableOpacity
        style={[styles.visibilityCard, value === 'public' && styles.visibilityCardActive]}
        onPress={() => onChange('public')}
        activeOpacity={0.8}
      >
        <Text style={styles.visibilityIcon}>🌍</Text>
        <View style={styles.visibilityText}>
          <Text style={[styles.visibilityTitle, value === 'public' && styles.visibilityTitleActive]}>
            Visible on map
          </Text>
          <Text style={styles.visibilitySub}>Others nearby can discover you</Text>
        </View>
        {value === 'public' ? <Text style={styles.visibilityCheck}>✓</Text> : null}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.visibilityCard, value === 'private' && styles.visibilityCardActive]}
        onPress={() => onChange('private')}
        activeOpacity={0.8}
      >
        <Text style={styles.visibilityIcon}>👻</Text>
        <View style={styles.visibilityText}>
          <Text style={[styles.visibilityTitle, value === 'private' && styles.visibilityTitleActive]}>
            Invisible
          </Text>
          <Text style={styles.visibilitySub}>You browse; no one sees you</Text>
        </View>
        {value === 'private' ? <Text style={styles.visibilityCheck}>✓</Text> : null}
      </TouchableOpacity>
    </View>
  );
}

export function ProfileCreationScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const { loading, error } = useAppSelector((s) => s.profile);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingState>({
    displayName: authUser?.displayName ?? '',
    bio: '',
    dateOfBirth: '',
    hometownCity: '',
    hometownCountry: '',
    showAge: true,
    showHometown: true,
    goals: [],
    visibility: 'public',
  });
  const [bioError, setBioError] = useState('');
  const [originError, setOriginError] = useState('');

  const toggleGoal = (v: string): void => {
    setForm((f) => ({
      ...f,
      goals: f.goals.includes(v) ? f.goals.filter((g) => g !== v) : [...f.goals, v],
    }));
  };

  const canAdvance = (): boolean => {
    if (step === 1) return form.displayName.trim().length > 0;
    if (step === 2) return form.bio.trim().length > 0;
    if (step === 3) {
      const dob = form.dateOfBirth.trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(dob) && isAdult(dob);
    }
    return true;
  };

  const advance = (): void => {
    if (step === 2 && !form.bio.trim()) {
      setBioError('A short bio is required to continue.');
      return;
    }
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
    setBioError('');
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      void dispatch(
        updateProfile({
          displayName: form.displayName.trim(),
          bio: form.bio.trim(),
          dateOfBirth: form.dateOfBirth.trim(),
          hometownCity: form.hometownCity.trim() || null,
          hometownCountry: form.hometownCountry.trim() || null,
          showAge: form.showAge,
          showHometown: form.showHometown,
          goals: form.goals,
          visibility: form.visibility,
        }),
      );
    }
  };

  if (step === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.welcomeBody}>
          <Text style={styles.logo}>G88</Text>
          <Text style={styles.welcomeHeading}>Welcome to G88</Text>
          <Text style={styles.welcomeSub}>
            A map-first social space for the people around you.{'\n'}
            Let's set up your profile in a few quick steps.
          </Text>
        </View>
        <View style={styles.welcomeFooter}>
          <TouchableOpacity style={styles.btn} onPress={() => setStep(1)}>
            <Text style={styles.btnText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLastStep = step === TOTAL_STEPS;

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.progressRow}>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <View
            key={i}
            style={[styles.progressSegment, i < step && styles.progressSegmentFilled]}
          />
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <StepName
            value={form.displayName}
            onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
          />
        ) : null}
        {step === 2 ? (
          <StepBio
            value={form.bio}
            onChange={(v) => {
              setBioError('');
              setForm((f) => ({ ...f, bio: v }));
            }}
          />
        ) : null}
        {step === 3 ? (
          <StepOrigin
            dateOfBirth={form.dateOfBirth}
            hometownCity={form.hometownCity}
            hometownCountry={form.hometownCountry}
            showAge={form.showAge}
            showHometown={form.showHometown}
            onChange={(patch) => {
              setOriginError('');
              setForm((f) => ({ ...f, ...patch }));
            }}
            error={originError}
          />
        ) : null}
        {step === 4 ? (
          <StepGoals selected={form.goals} onToggle={toggleGoal} />
        ) : null}
        {step === 5 ? (
          <StepVisibility
            value={form.visibility}
            onChange={(v) => setForm((f) => ({ ...f, visibility: v }))}
          />
        ) : null}

        {bioError ? <Text style={styles.error}>{bioError}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.btn, styles.btnFlex, !canAdvance() && styles.btnDisabled]}
          onPress={advance}
          disabled={loading || !canAdvance()}
        >
          {loading && isLastStep ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={styles.btnText}>{isLastStep ? 'Finish' : 'Continue'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  welcomeBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
  },
  logo: {
    color: colors.primary,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 4,
  },
  welcomeHeading: {
    color: colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
  },
  welcomeSub: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  welcomeFooter: { padding: spacing.xxl },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.xxl,
    paddingTop: 56,
    paddingBottom: spacing.sm,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.surfaceAlt,
  },
  progressSegmentFilled: { backgroundColor: colors.primary },
  scroll: { padding: spacing.xxl, paddingBottom: spacing.sm, flexGrow: 1 },
  stepBody: { gap: spacing.md },
  stepHeading: {
    color: colors.textPrimary,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    marginBottom: 4,
  },
  stepSub: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginBottom: spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginTop: 4,
  },
  toggleLabel: {
    color: colors.textPrimary,
    fontSize: fontSize.md,
    fontWeight: '500',
    flex: 1,
    marginRight: spacing.md,
  },
  bioInput: { minHeight: 120 },
  charCount: {
    color: colors.textFaint,
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  error: { color: colors.danger, fontSize: fontSize.sm, marginTop: 4 },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  goalChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,212,255,0.1)',
  },
  goalIcon: { fontSize: 18 },
  goalLabel: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  goalLabelActive: { color: colors.primary },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    marginBottom: spacing.md,
  },
  visibilityCardActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,212,255,0.06)',
  },
  visibilityIcon: { fontSize: 28 },
  visibilityText: { flex: 1, gap: 2 },
  visibilityTitle: {
    color: colors.textSecondary,
    fontSize: fontSize.md + 1,
    fontWeight: '600',
  },
  visibilityTitleActive: { color: colors.textPrimary },
  visibilitySub: { color: colors.textFaint, fontSize: fontSize.sm },
  visibilityCheck: { color: colors.primary, fontSize: 18, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.xxl,
    paddingTop: spacing.md,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    justifyContent: 'center',
  },
  backBtnText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: fontSize.md,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: 14,
    alignItems: 'center',
  },
  btnFlex: { flex: 1 },
  btnDisabled: { opacity: 0.4 },
  btnText: {
    color: colors.onPrimary,
    fontWeight: '700',
    fontSize: fontSize.md,
  },
});
