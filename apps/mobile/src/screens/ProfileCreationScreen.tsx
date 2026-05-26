import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateProfile } from '@/features/profile/profileSlice';
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';

const TOTAL_STEPS = 4;

interface OnboardingState {
  displayName: string;
  bio: string;
  goals: string[];
  visibility: 'public' | 'private';
}

// ─── Step components ───────────────────────────────────────────────────────

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

// ─── Main screen ───────────────────────────────────────────────────────────

export function ProfileCreationScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const { loading, error } = useAppSelector((s) => s.profile);

  const [step, setStep] = useState(0);
  const [form, setForm] = useState<OnboardingState>({
    displayName: authUser?.displayName ?? '',
    bio: '',
    goals: [],
    visibility: 'public',
  });
  const [bioError, setBioError] = useState('');

  const toggleGoal = (v: string): void => {
    setForm((f) => ({
      ...f,
      goals: f.goals.includes(v) ? f.goals.filter((g) => g !== v) : [...f.goals, v],
    }));
  };

  const canAdvance = (): boolean => {
    if (step === 1) return form.displayName.trim().length > 0;
    if (step === 2) return form.bio.trim().length > 0;
    return true;
  };

  const advance = (): void => {
    if (step === 2 && !form.bio.trim()) {
      setBioError('A short bio is required to continue.');
      return;
    }
    setBioError('');
    if (step < TOTAL_STEPS) {
      setStep((s) => s + 1);
    } else {
      void dispatch(
        updateProfile({
          displayName: form.displayName.trim(),
          bio: form.bio.trim(),
          goals: form.goals,
          visibility: form.visibility,
        }),
      );
    }
  };

  // ── Welcome splash ────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.welcomeBody}>
          <Text style={styles.logo}>G88</Text>
          <Text style={styles.welcomeHeading}>Welcome to G88</Text>
          <Text style={styles.welcomeSub}>
            A map-first social space for the people around you.{'\n'}
            Let's set up your profile in 4 quick steps.
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

  // ── Data steps ────────────────────────────────────────────────────────────
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
          <StepGoals selected={form.goals} onToggle={toggleGoal} />
        )}
        {step === 4 && (
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

  // Welcome
  welcomeBody: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 16 },
  logo: { color: '#00d4ff', fontSize: 48, fontWeight: '800', letterSpacing: 4 },
  welcomeHeading: { color: '#fff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  welcomeSub: { color: '#aaa', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  welcomeFooter: { padding: 24 },

  // Progress
  progressRow: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 8,
  },
  progressSegment: { flex: 1, height: 3, borderRadius: 2, backgroundColor: '#1a1a2e' },
  progressSegmentFilled: { backgroundColor: '#00d4ff' },

  // Steps
  scroll: { padding: 24, paddingBottom: 8, flexGrow: 1 },
  stepBody: { gap: 12 },
  stepHeading: { color: '#fff', fontSize: 28, fontWeight: '700', lineHeight: 36, marginBottom: 4 },
  stepSub: { color: '#888', fontSize: 14, lineHeight: 20, marginBottom: 8 },

  // Inputs
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

  // Goals
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

  // Visibility
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

  // Footer
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
