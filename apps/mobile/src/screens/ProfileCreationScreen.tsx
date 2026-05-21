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
} from 'react-native';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { updateProfile } from '@/features/profile/profileSlice';

/**
 * Shown immediately after registration (or when profile.profileComplete = false).
 * Collects a bio. Display name is pre-filled from auth but editable.
 * Submitting sets bio → profileComplete becomes true → navigator auto-routes to Main.
 */
export function ProfileCreationScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((s) => s.auth.user);
  const { loading, error } = useAppSelector((s) => s.profile);

  const [displayName, setDisplayName] = useState(authUser?.displayName ?? '');
  const [bio, setBio] = useState('');
  const [bioError, setBioError] = useState('');

  const submit = (): void => {
    if (!bio.trim()) {
      setBioError('A short bio is required to continue.');
      return;
    }
    setBioError('');
    void dispatch(updateProfile({ displayName: displayName.trim(), bio: bio.trim() }));
  };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>G88</Text>
        <Text style={styles.heading}>Set up your profile</Text>
        <Text style={styles.sub}>This is how others will find you on the map.</Text>

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

        <Text style={styles.label}>About you</Text>
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={setBio}
          placeholder="A short bio — what are you here for?"
          placeholderTextColor="#666"
          multiline
          maxLength={160}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{bio.length}/160</Text>

        {bioError ? <Text style={styles.error}>{bioError}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, !bio.trim() && styles.btnDisabled]}
          onPress={submit}
          disabled={loading || !bio.trim()}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>Continue</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: { padding: 24, gap: 8 },
  logo: { color: '#00d4ff', fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  sub: { color: '#aaa', fontSize: 14, textAlign: 'center', marginBottom: 20 },
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
  error: { color: '#ff6b6b', fontSize: 13, textAlign: 'center' },
  btn: {
    backgroundColor: '#00d4ff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#000', fontWeight: '700', fontSize: 15 },
});
