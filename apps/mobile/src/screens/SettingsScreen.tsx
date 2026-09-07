import React, { useCallback, useState } from 'react';
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

import { appAlert } from '@/ui/appAlert';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { AccountStackParamList } from '@/navigation/stacks';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { deleteAccount, logout } from '@/features/auth/authSlice';
import { fetchProfile, updateProfile } from '@/features/profile/profileSlice';
import { APP_VERSION } from '@/constants/app';
import { ScreenHeader } from '@/components/ScreenHeader';
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
        appAlert('Could not update', (result.payload as string) || 'Try again.');
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
        appAlert('Could not update', (result.payload as string) || 'Try again.');
      }
    } finally {
      setTogglingOnline(false);
    }
  };

  const onLogout = (): void => {
    appAlert('Log out?', 'You can sign back in any time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          void dispatch(logout());
        },
      },
    ]);
  };

  const openDelete = (): void => {
    setDeletePassword('');
    setDeleteOpen(true);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deletePassword.trim()) {
      appAlert('Password required', 'Enter your password to confirm account deletion.');
      return;
    }
    const result = await dispatch(deleteAccount({ password: deletePassword }));
    if (deleteAccount.rejected.match(result)) {
      appAlert('Could not delete account', (result.payload as string) || 'Try again.');
      return;
    }
    setDeleteOpen(false);
  };

  return (
    <View style={styles.root}>
      <ScreenHeader title="Settings" bordered />
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
            {toggling ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Switch
                value={isVisible}
                onValueChange={toggleVisibility}
                trackColor={{ false: colors.borderStrong, true: 'rgba(0,212,255,0.35)' }}
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
                trackColor={{ false: colors.borderStrong, true: 'rgba(0,212,255,0.35)' }}
                thumbColor={friendsSeeOnline ? colors.primary : colors.textFaint}
              />
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('ProfileEdit')}
          >
            <Icon name="account-edit-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.linkLabel}>Edit profile</Text>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Verification')}
          >
            <Icon name="shield-check-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.linkLabel}>Verification</Text>
            <Text style={styles.linkMeta}>{emailVerified ? 'Email ✓' : 'Start'}</Text>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('SocialLinking')}
          >
            <Icon name="link-variant" size={22} color={colors.textPrimary} />
            <Text style={styles.linkLabel}>Connected accounts</Text>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Subscription')}
          >
            <Icon name="star-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.linkLabel}>Premium</Text>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Privacy & safety</Text>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('Privacy')}
          >
            <Icon name="lock-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.linkLabel}>Privacy</Text>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('BlockedUsers')}
          >
            <Icon name="block-helper" size={22} color={colors.textPrimary} />
            <Text style={styles.linkLabel}>Blocked users</Text>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate('NotificationSettings')}
          >
            <Icon name="bell-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.linkLabel}>Notifications</Text>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Help')}>
            <Icon name="help-circle-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.linkLabel}>Help</Text>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('About')}>
            <Icon name="information-outline" size={22} color={colors.textPrimary} />
            <Text style={styles.linkLabel}>About</Text>
            <Text style={styles.linkMeta}>v{APP_VERSION}</Text>
            <Icon name="chevron-right" size={22} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={openDelete}>
          <Text style={styles.deleteText}>Delete account</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>G88 · local discovery</Text>
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account</Text>
            <Text style={styles.modalBody}>
              This permanently removes your profile, listings, and messages. Enter your password to confirm.
            </Text>
            <TextInput
              style={styles.modalInput}
              value={deletePassword}
              onChangeText={setDeletePassword}
              placeholder="Password"
              placeholderTextColor={colors.textFaint}
              secureTextEntry
              autoCapitalize="none"
            />
            {authError ? <Text style={styles.modalError}>{authError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setDeleteOpen(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirm, authLoading && styles.modalDisabled]}
                onPress={() => void confirmDelete()}
                disabled={authLoading}
              >
                {authLoading ? (
                  <ActivityIndicator color={colors.onPrimary} />
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
  body: { paddingBottom: spacing.xxl },
  section: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.textMuted,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowSpaced: { marginTop: spacing.sm },
  rowContent: { flex: 1, gap: 2 },
  rowLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
  rowSub: { color: colors.textMuted, fontSize: fontSize.sm, lineHeight: 18 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  linkLabel: { flex: 1, color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '500' },
  linkMeta: { color: colors.textMuted, fontSize: fontSize.sm, marginRight: 4 },
  logoutBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
  },
  logoutText: { color: colors.danger, fontWeight: '600', fontSize: fontSize.md },
  deleteBtn: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.35)',
  },
  deleteText: { color: colors.danger, fontWeight: '700', fontSize: fontSize.md },
  footerNote: {
    textAlign: 'center',
    color: colors.textFaint,
    fontSize: fontSize.xs,
    marginTop: spacing.xl,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,68,68,0.25)',
  },
  modalTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  modalBody: { color: colors.textMuted, fontSize: fontSize.sm, marginTop: 8, lineHeight: 20 },
  modalInput: {
    marginTop: 14,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: fontSize.md,
  },
  modalError: { color: colors.danger, fontSize: fontSize.sm, marginTop: 10 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 18 },
  modalCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  modalCancelText: { color: colors.textSecondary, fontWeight: '600', fontSize: fontSize.md },
  modalConfirm: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.danger, alignItems: 'center' },
  modalConfirmText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  modalDisabled: { opacity: 0.5 },
});
