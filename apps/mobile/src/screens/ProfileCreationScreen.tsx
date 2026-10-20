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
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';
import { updateProfile } from '@/features/profile/profileSlice';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

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

function StepName({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
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

function StepBio({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stepBody}>
      <StepHeader
        eyebrow="CONTEXT"
        title="Give people a reason to connect."
        subtitle="A short bio adds context before someone waves or opens your profile."
      />
      <FormField
        value={value}
        onChangeText={onChange}
        placeholder="What should nearby people know about you?"
        multiline
        autoFocus
        maxLength={160}
        textAlignVertical="top"
        style={styles.bioInput}
        testID="onboarding-bio"
      />
      <Text style={[styles.charCount, { color: colors.textTertiary }]}>{value.length}/160</Text>
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
        eyebrow="PRIVACY"
        title="Age & origin"
        subtitle="You must be 18+. You decide whether age and origin appear on your profile."
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
        label="City of origin"
        value={hometownCity}
        onChangeText={(value) => onChange({ hometownCity: value })}
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
        onChangeText={(value) => onChange({ hometownCountry: value })}
        placeholder="e.g. BG"
        autoCapitalize="characters"
        maxLength={40}
        returnKeyType="done"
        testID="onboarding-country"
      />
      <View
        style={[
          styles.toggleRow,
          { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderDefault },
        ]}
      >
        <View style={styles.toggleCopy}>
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Show age</Text>
          <Text style={[styles.toggleHint, { color: colors.textTertiary }]}>Visible on your profile</Text>
        </View>
        <Switch
          value={showAge}
          onValueChange={(value) => onChange({ showAge: value })}
          trackColor={{ false: colors.borderStrong, true: colors.actionBorder }}
          thumbColor={showAge ? colors.actionPrimary : colors.textTertiary}
        />
      </View>
      <View
        style={[
          styles.toggleRow,
          { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderDefault },
        ]}
      >
        <View style={styles.toggleCopy}>
          <Text style={[styles.toggleLabel, { color: colors.textPrimary }]}>Show place of origin</Text>
          <Text style={[styles.toggleHint, { color: colors.textTertiary }]}>Visible on your profile</Text>
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

function StepGoals({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (value: string) => void;
}): React.JSX.Element {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stepBody}>
      <StepHeader
        eyebrow="DISCOVERY"
        title="What do you want to discover?"
        subtitle="Choose everything that fits. You can update these goals later."
      />
      <View style={styles.goalsGrid}>
        {GOAL_OPTIONS.map((goal) => {
          const active = selected.includes(goal.value);
          return (
            <TouchableOpacity
              key={goal.value}
              style={[
                styles.goalChip,
                {
                  backgroundColor: active ? colors.actionSoft : colors.surfaceSecondary,
                  borderColor: active ? colors.actionPrimary : colors.borderDefault,
                },
              ]}
              onPress={() => onToggle(goal.value)}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={styles.goalIcon}>{goal.icon}</Text>
              <Text
                style={[
                  styles.goalLabel,
                  { color: active ? colors.actionPrimary : colors.textSecondary },
                ]}
              >
                {goal.label}
              </Text>
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
  onChange: (value: 'public' | 'private') => void;
}): React.JSX.Element {
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
        accessibilityLabel="Discoverable on map"
      >
        <View style={[styles.visibilityIcon, { backgroundColor: colors.discoveryMutedBg }]}>
          <Icon name="map-marker-radius-outline" size={24} color={colors.discovery} />
        </View>
        <View style={styles.visibilityText}>
          <Text
            style={[
              styles.visibilityTitle,
              { color: value === 'public' ? colors.discovery : colors.textPrimary },
            ]}
          >
            Discoverable
          </Text>
          <Text style={[styles.visibilitySub, { color: colors.textTertiary }]}>
            Nearby people can find your profile on the map
          </Text>
        </View>
        {value === 'public' ? <Icon name="check-circle" size={21} color={colors.discovery} /> : null}
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.visibilityCard, optionStyle(value === 'private')]}
        onPress={() => onChange('private')}
        activeOpacity={0.78}
        accessibilityRole="button"
        accessibilityState={{ selected: value === 'private' }}
        accessibilityLabel="Private browsing"
      >
        <View style={[styles.visibilityIcon, { backgroundColor: colors.actionSoft }]}>
          <Icon name="eye-off-outline" size={24} color={colors.actionPrimary} />
        </View>
        <View style={styles.visibilityText}>
          <Text
            style={[
              styles.visibilityTitle,
              { color: value === 'private' ? colors.actionPrimary : colors.textPrimary },
            ]}
          >
            Private browsing
          </Text>
          <Text style={[styles.visibilitySub, { color: colors.textTertiary }]}>
            Explore the map without being shown to others
          </Text>
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

  const toggleGoal = (value: string): void => {
    setForm((current) => ({
      ...current,
      goals: current.goals.includes(value)
        ? current.goals.filter((goal) => goal !== value)
        : [...current.goals, value],
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
      setStep((current) => current + 1);
      return;
    }

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
  };

  if (step === 0) {
    return (
      <View style={[styles.root, { backgroundColor: colors.canvas }]}>
        <ScrollView
          contentContainerStyle={styles.welcomeBody}
          showsVerticalScrollIndicator={false}
        >
          <BrandLogo size={72} />
          <Text style={[styles.welcomeEyebrow, { color: colors.discovery }]}>YOUR LOCAL WORLD</Text>
          <NexaDiscoveryHero />
          <Text style={[styles.welcomeHeading, { color: colors.textPrimary }]}>Make the map yours.</Text>
          <Text style={[styles.welcomeSub, { color: colors.textSecondary }]}>
            Set up your profile, choose what you’re here for, and decide how you appear on the map.
          </Text>
        </ScrollView>
        <View
          style={[
            styles.welcomeFooter,
            { backgroundColor: colors.canvas, borderTopColor: colors.borderSubtle },
          ]}
        >
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: colors.actionPrimary }]}
            onPress={() => setStep(1)}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Set up my profile"
          >
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Set up my profile</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isLastStep = step === TOTAL_STEPS;
  const allowAdvance = canAdvance();

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={styles.progressWrap}
        accessible
        accessibilityLabel={`Profile setup, step ${step} of ${TOTAL_STEPS}`}
      >
        <View style={styles.progressTopline}>
          <Text style={[styles.progressLabel, { color: colors.textTertiary }]}>PROFILE SETUP</Text>
          <Text style={[styles.progressCount, { color: colors.discovery }]}>
            {step}/{TOTAL_STEPS}
          </Text>
        </View>
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.progressSegment,
                {
                  backgroundColor:
                    index < step ? colors.discovery : colors.surfaceTertiary,
                },
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {step === 1 ? (
          <StepName
            value={form.displayName}
            onChange={(value) => setForm((current) => ({ ...current, displayName: value }))}
          />
        ) : null}
        {step === 2 ? (
          <StepBio
            value={form.bio}
            onChange={(value) => {
              setBioError('');
              setForm((current) => ({ ...current, bio: value }));
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
              setForm((current) => ({ ...current, ...patch }));
            }}
            error={originError}
          />
        ) : null}
        {step === 4 ? <StepGoals selected={form.goals} onToggle={toggleGoal} /> : null}
        {step === 5 ? (
          <StepVisibility
            value={form.visibility}
            onChange={(value) => setForm((current) => ({ ...current, visibility: value }))}
          />
        ) : null}

        {bioError ? <Text style={[styles.error, { color: colors.danger }]}>{bioError}</Text> : null}
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.canvas, borderTopColor: colors.borderSubtle },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.backButton,
            { backgroundColor: colors.surfaceSecondary, borderColor: colors.borderDefault },
          ]}
          onPress={() => setStep((current) => current - 1)}
          activeOpacity={0.78}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Icon name="arrow-left" size={18} color={colors.textSecondary} />
          <Text style={[styles.backButtonText, { color: colors.textSecondary }]}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.primaryButtonFlex,
            { backgroundColor: colors.actionPrimary },
            !allowAdvance && styles.buttonDisabled,
          ]}
          onPress={advance}
          disabled={loading || !allowAdvance}
          activeOpacity={0.82}
          accessibilityRole="button"
          accessibilityLabel={isLastStep ? 'Finish profile setup' : 'Continue'}
        >
          {loading && isLastStep ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <>
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                {isLastStep ? 'Enter NEXA' : 'Continue'}
              </Text>
              {!isLastStep ? <Icon name="arrow-right" size={18} color={colors.onPrimary} /> : null}
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  welcomeBody: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: 40,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  welcomeEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  welcomeHeading: {
    fontSize: 30,
    lineHeight: 36,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: spacing.xs,
  },
  welcomeSub: {
    maxWidth: 380,
    fontSize: fontSize.md,
    lineHeight: 22,
    textAlign: 'center',
  },
  welcomeFooter: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  progressWrap: {
    paddingHorizontal: spacing.xl,
    paddingTop: 52,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  progressTopline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  progressCount: {
    fontSize: fontSize.xs,
    fontWeight: '800',
  },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
  },
  progressSegment: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  scroll: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  stepBody: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    gap: spacing.md,
  },
  stepHeader: {
    gap: 7,
    marginBottom: spacing.xs,
  },
  stepEyebrow: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  stepHeading: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.35,
  },
  stepSub: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  toggleRow: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleCopy: {
    flex: 1,
    gap: 2,
    marginRight: spacing.md,
  },
  toggleLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  toggleHint: {
    fontSize: fontSize.xs,
  },
  bioInput: { minHeight: 120 },
  charCount: {
    fontSize: fontSize.xs,
    textAlign: 'right',
  },
  error: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    marginTop: spacing.sm,
  },
  goalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  goalChip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  goalIcon: { fontSize: 18 },
  goalLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  visibilityCard: {
    minHeight: 82,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  visibilityIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visibilityText: {
    flex: 1,
    gap: 3,
  },
  visibilityTitle: {
    fontSize: fontSize.md + 1,
    fontWeight: '700',
  },
  visibilitySub: {
    fontSize: fontSize.sm,
    lineHeight: 19,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  backButton: {
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  primaryButton: {
    minHeight: 50,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonFlex: { flex: 1 },
  buttonDisabled: { opacity: 0.4 },
  primaryButtonText: {
    fontWeight: '800',
    fontSize: fontSize.md,
  },
});
