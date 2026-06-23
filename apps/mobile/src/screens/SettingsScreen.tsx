import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { deleteAccount, logout } from '@/features/auth/authSlice';
import { updateProfile } from '@/features/profile/profileSlice';

// Canonical hosted privacy policy (Render static site `g88-legal`). The store
// listing + Data Safety form point at the same URL.
const PRIVACY_POLICY_URL = 'https://g88-legal.onrender.com/privacy';

export function SettingsScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const profile = useAppSelector((s) => s.profile.profile);
  const { loading } = useAppSelector((s) => s.profile);

  const authError = useAppSelector((s) => s.auth.error);
  const authLoading = useAppSelector((s) => s.auth.loading);

  const [toggling, setToggling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const isVisible = profile?.visibility !== 'private';

  const toggleVisibility = async (): Promise<void> => {
    if (toggling || !profile) return;
    setToggling(true);
    try {
      await dispatch(
        updateProfile({ visibility: isVisible ? 'private' : 'public' }),
      );
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = (): void => {
    void dispatch(logout());
  };

  const openPrivacyPolicy = (): void => {
    void Linking.openURL(PRIVACY_POLICY_URL);
  };

  const confirmDelete = async (): Promise<void> => {
    // On success the thunk clears the session → AppNavigator routes to Auth, so
    // this screen unmounts; no manual navigation needed. On failure the modal
    // stays open and surfaces the error (e.g. wrong password).
    const pw = deletePassword.trim();
    const result = await dispatch(deleteAccount(pw ? { password: pw } : {}));
    if (deleteAccount.fulfilled.match(result)) {
      setDeleteOpen(false);
      setDeletePassword('');
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Appear on map</Text>
            <Text style={styles.rowSub}>
              {isVisible
                ? 'Others can see you nearby'
                : 'You are hidden from discovery'}
            </Text>
          </View>
          {toggling || loading ? (
            <ActivityIndicator color="#00d4ff" />
          ) : (
            <Switch
              value={isVisible}
              onValueChange={toggleVisibility}
              trackColor={{ false: '#2a2a4a', true: '#0095b3' }}
              thumbColor={isVisible ? '#00d4ff' : '#555'}
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('NotificationSettings')}>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Push notifications</Text>
            <Text style={styles.rowSub}>Choose which alerts you receive</Text>
          </View>
          <Icon name="chevron-right" size={24} color="#555" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Legal</Text>
        <TouchableOpacity style={styles.row} onPress={openPrivacyPolicy}>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Privacy Policy</Text>
            <Text style={styles.rowSub}>How we handle your data</Text>
          </View>
          <Icon name="open-in-new" size={20} color="#555" />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => {
            setDeletePassword('');
            setDeleteOpen(true);
          }}
        >
          <Text style={styles.deleteText}>Delete account</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account?</Text>
            <Text style={styles.modalBody}>
              This permanently deletes your profile, photos, messages, and activity.
              It cannot be undone.
            </Text>
            <TextInput
              style={styles.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password (if you signed up with email)"
              placeholderTextColor="#555"
              secureTextEntry
              autoCapitalize="none"
              editable={!authLoading}
            />
            {authError ? <Text style={styles.modalError}>{authError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setDeleteOpen(false)}
                disabled={authLoading}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalConfirm]}
                onPress={confirmDelete}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalConfirmText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f', padding: 24 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 24 },
  section: { marginBottom: 32 },
  sectionTitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  rowContent: { flex: 1 },
  rowLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  rowSub: { color: '#666', fontSize: 12, marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a1a1a',
  },
  logoutText: { color: '#ff6b6b', fontWeight: '600', fontSize: 15 },
  deleteBtn: {
    marginTop: 12,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5a1a1a',
  },
  deleteText: { color: '#ff4d4d', fontWeight: '700', fontSize: 15 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: '#3a1a1a',
  },
  modalTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 10 },
  modalBody: { color: '#aaa', fontSize: 14, lineHeight: 20, marginBottom: 16 },
  input: {
    backgroundColor: '#0a0a0f',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  modalError: { color: '#ff6b6b', fontSize: 13, marginTop: 10 },
  modalActions: { flexDirection: 'row', marginTop: 20, gap: 12 },
  modalBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  modalCancel: { backgroundColor: '#2a2a4a' },
  modalCancelText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  modalConfirm: { backgroundColor: '#c0392b' },
  modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
