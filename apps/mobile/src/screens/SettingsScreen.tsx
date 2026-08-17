import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
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

import type { AccountStackParamList } from '@/navigation/stacks';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { deleteAccount, logout } from '@/features/auth/authSlice';
import { updateProfile } from '@/features/profile/profileSlice';

export function SettingsScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const profile = useAppSelector((s) => s.profile.profile);
  const { loading } = useAppSelector((s) => s.profile);

  const authError = useAppSelector((s) => s.auth.error);
  const authLoading = useAppSelector((s) => s.auth.loading);

  const [toggling, setToggling] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const isVisible = profile?.visibility !== 'private';
  const friendsSeeOnline = profile?.friendsSeeOnlineStatus !== false;

  const emailVerified = profile != null && profile.verification !== 'none';

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

  const toggleFriendsOnline = async (): Promise<void> => {
    if (togglingOnline || !profile) return;
    setTogglingOnline(true);
    try {
      await dispatch(
        updateProfile({ friendsSeeOnlineStatus: !friendsSeeOnline }),
      );
    } finally {
      setTogglingOnline(false);
    }
  };

  const handleLogout = (): void => {
    void dispatch(logout());
  };

  const confirmDelete = async (): Promise<void> => {
    const pw = deletePassword.trim();
    const result = await dispatch(deleteAccount(pw ? { password: pw } : {}));
    if (deleteAccount.fulfilled.match(result)) {
      setDeleteOpen(false);
      setDeletePassword('');
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.back} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovery</Text>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Appear on map</Text>
              <Text style={styles.rowSub}>
                {isVisible
                  ? 'Others can see you nearby on the map'
                  : 'Hidden from discovery — you can still browse'}
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
          <View style={[styles.row, styles.rowSpaced]}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Friends can see when I\'m online</Text>
              <Text style={styles.rowSub}>
                {friendsSeeOnline
                  ? 'Close friends see you as online in chat and friends list'
                  : 'Hidden from friends — you still appear in lists without a green dot'}
              </Text>
            </View>
            {togglingOnline || loading ? (
              <ActivityIndicator color="#00d4ff" />
            ) : (
              <Switch
                value={friendsSeeOnline}
                onValueChange={toggleFriendsOnline}
                trackColor={{ false: '#2a2a4a', true: '#0095b3' }}
                thumbColor={friendsSeeOnline ? '#00d4ff' : '#555'}
              />
            )}
          </View>
          <TouchableOpacity
            style={[styles.row, styles.rowSpaced]}
            onPress={() => navigation.navigate('BlockedUsers')}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Blocked users</Text>
              <Text style={styles.rowSub}>People you have hidden and muted</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#555" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trust & posting</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('Verification')}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Verification</Text>
              <Text style={styles.rowSub}>
                Email, phone, and ID review — builds trust and unlocks stories
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color="#555" />
          </TouchableOpacity>
          {!emailVerified ? (
            <TouchableOpacity
              style={[styles.row, styles.rowSpaced]}
              onPress={() => navigation.navigate('EmailVerification')}
            >
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>Verify email</Text>
                <Text style={styles.rowSub}>Required to post stories on Pulse</Text>
              </View>
              <Icon name="chevron-right" size={24} color="#555" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Push notifications</Text>
              <Text style={styles.rowSub}>Waves, chats, stories, trades, and more</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#555" />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Privacy')}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Privacy</Text>
              <Text style={styles.rowSub}>Location, stories, data, and account deletion</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#555" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowSpaced]}
            onPress={() => navigation.navigate('About')}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>About G88</Text>
              <Text style={styles.rowSub}>What the app does and version info</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#555" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.row, styles.rowSpaced]}
            onPress={() => navigation.navigate('Help')}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Help & Support</Text>
              <Text style={styles.rowSub}>FAQs and contact</Text>
            </View>
            <Icon name="chevron-right" size={24} color="#555" />
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
      </ScrollView>

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
              This permanently deletes your profile, photos, stories, messages, and
              activity. It cannot be undone.
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
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    paddingTop: 56,
  },
  back: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  body: { padding: 24, paddingBottom: 48 },
  section: { marginBottom: 28 },
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
  rowSpaced: { marginTop: 12 },
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
