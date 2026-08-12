import React, { useState } from 'react';
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

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateProfile } from '@/features/profile/profileSlice';
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';

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
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder="Your name"
        placeholderTextColor="#555"
        autoCapitalize="words"
        autoFocus
        maxLength={40}
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
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={value}
        onChangeText={onChange}
        placeholder="A short bio — what are you here for?"
        placeholderTextColor="#555"
        multiline
        autoFocus
        maxLength={160}
        textAlignVertical="top"
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
  return (
    <View style={styles.stepBody}>
      <Text style={styles.stepHeading}>Age & origin</Text>
      <Text style={styles.stepSub}>
        You must be 18+. Others only see your age and place if you allow it.
      </Text>
      <Text style={styles.fieldLabel}>Date of birth</Text>
      <TextInput
        style={styles.input}
        value={dateOfBirth}
        onChangeText={(v) => onChange({ dateOfBirth: v })}
        placeholder="YYYY-MM-DD"
        placeholderTextColor="#555"
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        autoCapitalize="none"
      />
      <Text style={styles.fieldLabel}>City of origin</Text>
      <TextInput
        style={styles.input}
        value={hometownCity}
        onChangeText={(v) => onChange({ hometownCity: v })}
        placeholder="e.g. Sofia"
        placeholderTextColor="#555"
        autoCapitalize="words"
        maxLength={80}
      />
      <Text style={styles.fieldLabel}>Country</Text>
      <TextInput
        style={styles.input}
        value={hometownCountry}
        onChangeText={(v) => onChange({ hometownCountry: v })}
        placeholder="e.g. BG"
        placeholderTextColor="#555"
        autoCapitalize="characters"
        maxLength={40}
      />
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show age on profile</Text>
        <Switch
          value={showAge}
          onValueChange={(v) => onChange({ showAge: v })}
          trackColor={{ false: '#2a2a4a', true: '#0095b3' }}
          thumbColor={showAge ? '#00d4ff' : '#555'}
        />
      </View>
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Show place of origin</Text>
        <Switch
          value={showHometown}
          onValueChange={(v) => onChange({ showHometown: v })}
          trackColor={{ false: '#2a2a4a', true: '#0095b3' }}
          thumbColor={showHometown ? '#00d4ff' : '#555'}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
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
        {value === 'public' && <Text style={styles.visibilityCheck}>✓</Text>}
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
        {value === 'private' && <Text style={styles.visibilityCheck}>✓</Text>}
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
        {step === 1 && (
          <StepName
            value={form.displayName}
            onChange={(v) => setForm((f) => ({ ...f, displayName: v }))}
          />
        )}
        {step === 2 && (
          <StepBio
            value={form.bio}
            onChange={(v) => {
              setBioError('');
              setForm((f) => ({ ...f, bio: v }));
            }}
          />
        )}
        {step === 3 && (
          <StepOrigin
            dateOfBirth={form.dateOfBirth}
            hometownCity={form.hometownCity}
            hometownCountry={form.hometownCountry}
            showAge={form.showAge}
            showHometown={form.showHometown}
            onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
            error={originError}
          />
        )}
        {step === 4 && (
          <StepGoals selected={form.goals} onToggle={toggleGoal} />
        )}
        {step === 5 && (
          <StepVisibility
            value={form.visibility}
            onChange={(v) => setForm((f) => ({ ...f, visibility: v }))}
          />
        )}

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
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>{isLastStep ? 'Finish' : 'Continue'}</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  welcomeBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  logo: { color: '#00d4ff', fontSize: 48, fontWeight: '800', letterSpacing: 4 },
  welcomeHeading: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  welcomeSub: { color: '#aaa', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  welcomeFooter: { padding: 24 },
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 8,
  },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#1a1a2e' },
  progressSegmentFilled: { backgroundColor: '#00d4ff' },
  scroll: { padding: 24, paddingBottom: 8, flexGrow: 1 },
  stepBody: { gap: 12 },
  stepHeading: { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 36, marginBottom: 4 },
  stepSub: { color: '#888', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  fieldLabel: {
    color: '#aaa',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    marginTop: 4,
  },
  toggleLabel: { color: '#fff', fontSize: 15, fontWeight: '500', flex: 1, marginRight: 12 },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  bioInput: { minHeight: 120 },
  charCount: { color: '#555', fontSize: 12, textAlign: 'right' },
  error: { color: '#ff6b6b', fontSize: 13, marginTop: 4 },
  goalsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  goalChipActive: { borderColor: '#00d4ff', backgroundColor: '#00d4ff18' },
  goalIcon: { fontSize: 18 },
  goalLabel: { color: '#aaa', fontSize: 14, fontWeight: '500' },
  goalLabelActive: { color: '#00d4ff' },
  visibilityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    marginBottom: 12,
  },
  visibilityCardActive: { borderColor: '#00d4ff', backgroundColor: '#00d4ff10' },
  visibilityIcon: { fontSize: 28 },
  visibilityText: { flex: 1, gap: 2 },
  visibilityTitle: { color: '#aaa', fontSize: 16, fontWeight: '600' },
  visibilityTitleActive: { color: '#fff' },
  visibilitySub: { color: '#555', fontSize: 13 },
  visibilityCheck: { color: '#00d4ff', fontSize: 18, fontWeight: '700' },
  footer: { flexDirection: 'row', gap: 12, padding: 24, paddingTop: 12 },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
  },
  backBtnText: { color: '#aaa', fontWeight: '600', fontSize: 15 },
  btn: {
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  btnFlex: { flex: 1 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
