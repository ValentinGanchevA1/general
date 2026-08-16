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
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AccountStackParamList } from '@/navigation/stacks';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateProfile } from '@/features/profile/profileSlice';

type Nav = NativeStackNavigationProp<AccountStackParamList>;

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
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const { profile, loading, error } = useAppSelector((s) => s.profile);

  const [displayName, setDisplayName] = useState(profile?.displayName ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.dateOfBirth?.slice(0, 10) ?? '');
  const [hometownCity, setHometownCity] = useState(profile?.hometownCity ?? '');
  const [hometownCountry, setHometownCountry] = useState(profile?.hometownCountry ?? '');
  const [showAge, setShowAge] = useState(profile?.showAge ?? true);
  const [showHometown, setShowHometown] = useState(profile?.showHometown ?? true);
  const [localError, setLocalError] = useState('');

  const save = async (): Promise<void> => {
    setLocalError('');
    const dob = dateOfBirth.trim();
    if (dob) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
        setLocalError('Date of birth must be YYYY-MM-DD');
        return;
      }
      if (!isAdult(dob)) {
        setLocalError('You must be at least 18 years old');
        return;
      }
    }
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
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.heading}>Edit Profile</Text>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          style={styles.input}
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="Your name"
          placeholderTextColor="#666"
          autoCapitalize="words"
          maxLength={40}
        />

        <Text style={styles.label}>Bio</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="Tell others about yourself"
          placeholderTextColor="#666"
          multiline
          maxLength={160}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{bio.length}/160</Text>

        <Text style={styles.section}>Age & origin</Text>

        <Text style={styles.label}>Date of birth</Text>
        <TextInput
          style={styles.input}
          value={dateOfBirth}
          onChangeText={setDateOfBirth}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#666"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          autoCapitalize="none"
        />
        <Text style={styles.hint}>Must be 18+. Only your age is shown publicly (if enabled).</Text>

        <Text style={styles.label}>City of origin</Text>
        <TextInput
          style={styles.input}
          value={hometownCity}
          onChangeText={setHometownCity}
          placeholder="e.g. Sofia"
          placeholderTextColor="#666"
          autoCapitalize="words"
          maxLength={80}
        />

        <Text style={styles.label}>Country</Text>
        <TextInput
          style={styles.input}
          value={hometownCountry}
          onChangeText={setHometownCountry}
          placeholder="e.g. BG or Bulgaria"
          placeholderTextColor="#666"
          autoCapitalize="characters"
          maxLength={40}
        />

        <View style={styles.toggleRow}>
          <View style={styles.toggleText}>
            <Text style={styles.toggleLabel}>Show age on profile</Text>
            <Text style={styles.toggleSub}>Others see age next to your name</Text>
          </View>
          <Switch
            value={showAge}
            onValueChange={setShowAge}
            trackColor={{ false: '#2a2a4a', true: '#0095b3' }}
            thumbColor={showAge ? '#00d4ff' : '#555'}
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
            trackColor={{ false: '#2a2a4a', true: '#0095b3' }}
            thumbColor={showHometown ? '#00d4ff' : '#555'}
          />
        </View>

        {localError ? <Text style={styles.error}>{localError}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity style={styles.btn} onPress={save} disabled={loading}>
          {loading ? (
            <ActivityIndicator color="#000" />
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
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { padding: 24, gap: 8, paddingBottom: 48 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 16 },
  section: {
    color: '#00d4ff',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 4,
  },
  label: { color: '#aaa', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#fff',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  bioInput: { minHeight: 100 },
  charCount: { color: '#555', fontSize: 12, textAlign: 'right' },
  hint: { color: '#555', fontSize: 12, marginBottom: 4 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    marginTop: 8,
  },
  toggleText: { flex: 1, marginRight: 12 },
  toggleLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  toggleSub: { color: '#666', fontSize: 12, marginTop: 2 },
  error: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
  btn: {
    backgroundColor: '#00d4ff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  cancelBtn: { alignItems: 'center', marginTop: 8 },
  cancelText: { color: '#555', fontSize: 14 },
});
