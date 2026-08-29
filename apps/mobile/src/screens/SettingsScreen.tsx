import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AccountStackParamList } from '@/navigation/stacks';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { deleteAccount, logout } from '@/features/auth/authSlice';
import { fetchProfile, updateProfile } from '@/features/profile/profileSlice';
import { colors, spacing, fontSize } from '@/theme';

export function SettingsScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<NativeStackNavigationProp<AccountStackParamList>>();
  const profile = useAppSelector((s) => s.profile.profile);

  const authError = useAppSelector((s) => s.auth.error);
  const authLoading = useAppSelector((s) => s.auth.loading);

  const [toggling, setToggling] = useState(false);
  const [togglingOnline, setTogglingOnline] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const isVisible = profile?.visibility !== 'private';
  const friendsSeeOnline = profile?.friendsSeeOnlineStatus !== false;

  useFocusEffect(
    useCallback(() => {
      if (!profile) {
        void dispatch(fetchProfile());
      }
    }, [dispatch, profile]),
  );

  const emailVerified = profile != null && profile.verification !== 'none';

  const toggleVisibility = async (): Promise<void> => {
    if (toggling || !profile) return;
    setToggling(true);
    try {
      const result = await dispatch(
        updateProfile({ visibility: isVisible ? 'private' : 'public' }),
      );
      if (updateProfile.rejected.match(result)) {
        Alert.alert('Could not update', (result.payload as string) || 'Try again.');
      }
    } finally {
      setToggling(false);
    }
  };

  const toggleFriendsOnline = async (): Promise<void> => {
    if (togglingOnline || !profile) return;
    setTogglingOnline(true);
    try {
      const result = await dispatch(
        updateProfile({ friendsSeeOnlineStatus: !friendsSeeOnline }),
      );
      if (updateProfile.rejected.match(result)) {
        Alert.alert('Could not update', (result.payload as string) || 'Try again.');
      }
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
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.lead}>
          Controls for discovery, trust, and your account. Privacy policy, help, and
          about live on your Profile menu.
        </Text>

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
            {toggling ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={isVisible}
                onValueChange={toggleVisibility}
                trackColor={{ false: colors.borderStrong, true: '#0095b3' }}
                thumbColor={isVisible ? colors.primary : colors.textFaint}
              />
            )}
          </View>
          <View style={[styles.row, styles.rowSpaced]}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Friends can see when I am online</Text>
              <Text style={styles.rowSub}>
                {friendsSeeOnline
                  ? 'Close friends see you online in chat and the friends list'
                  : 'Hidden from friends — you still appear in lists without a green dot'}
              </Text>
            </View>
            {togglingOnline ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={friendsSeeOnline}
                onValueChange={toggleFriendsOnline}
                trackColor={{ false: colors.borderStrong, true: '#0095b3' }}
                thumbColor={friendsSeeOnline ? colors.primary : colors.textFaint}
              />
            )}
          </View>
          <TouchableOpacity
            style={[styles.row, styles.rowSpaced]}
            onPress={() => navigation.navigate('BlockedUsers')}
          >
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Blocked users</Text>
              <Text style={styles.rowSub}>Hidden from map, chat, waves, and friend requests</Text>
            </View>
            <Icon name="chevron-right" size={24} color={colors.textFaint} />
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
                Email → phone → ID review. Raises trust and unlocks higher-stakes actions
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={colors.textFaint} />
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
              <Icon name="chevron-right" size={24} color={colors.textFaint} />
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
              <Text style={styles.rowSub}>
                Waves, friend requests, chats, stories, trades, and more
              </Text>
            </View>
            <Icon name="chevron-right" size={24} color={colors.textFaint} />
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
              This permanently deletes your profile, photos, stories, messages, friends,
              and activity. It cannot be undone.
            </Text>
            <TextInput
              style={styles.input}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password (if you signed up with email)"
              placeholderTextColor={colors.textFaint}
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
                  <ActivityIndicator color={colors.textPrimary} />
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
  root: { flex: 1, backgroundColor: colors.bg },
  body: { padding: spacing.xxl, paddingBottom: 48 },
  lead: {
    color: colors.textMuted,
    fontSize: fontSize.sm,
    lineHeight: 19,
    marginBottom: spacing.xl,
  },
  section: { marginBottom: 28 },
  sectionTitle: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.md,
  },
  row: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  rowSpaced: { marginTop: spacing.md },
  rowContent: { flex: 1 },
  rowLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '500' },
  rowSub: { color: colors.textFaint, fontSize: fontSize.xs, marginTop: 2 },
  logoutBtn: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a1a1a',
  },
  logoutText: { color: '#ff6b6b', fontWeight: '600', fontSize: fontSize.md },
  deleteBtn: {
    marginTop: spacing.md,
    borderRadius: 10,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#5a1a1a',
  },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: fontSize.md },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  modalCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: '#3a1a1a',
  },
  modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '700', marginBottom: 10 },
  modalBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: spacing.lg },
  input: {
    backgroundColor: colors.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: spacing.md,
    color: colors.textPrimary,
    fontSize: fontSize.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  modalError: { color: '#ff6b6b', fontSize: fontSize.sm, marginTop: 10 },
  modalActions: { flexDirection: 'row', marginTop: 20, gap: spacing.md },
  modalBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
  modalCancel: { backgroundColor: colors.borderStrong },
  modalCancelText: { color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.md },
  modalConfirm: { backgroundColor: '#c0392b' },
  modalConfirmText: { color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.md },
});
