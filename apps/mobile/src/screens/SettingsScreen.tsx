import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
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

import type { AccountStackParamList } from '@/navigation/stacks';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { deleteAccount, logout } from '@/features/auth/authSlice';
import { fetchProfile, updateProfile } from '@/features/profile/profileSlice';
import { ListRow } from '@/components/ListRow';
import { ScreenHeader } from '@/components/ScreenHeader';
import { APP_VERSION, TERMS_OF_SERVICE_URL } from '@/constants/app';
import { resolveNexaTrustActionLabel } from '@/product/nexaActionLanguage';
import {
  spacing,
  fontSize,
  radius,
  useAppTheme,
  type ThemeColors,
  type ThemeMode,
} from '@/theme';
import { resolveTrustNextStep, strikeStanding } from '@g88/shared';

const THEME_OPTIONS: ReadonlyArray<{ mode: ThemeMode; label: string; description: string }> = [
  { mode: 'system', label: 'System', description: 'Follow your device appearance' },
  { mode: 'light', label: 'Light', description: 'Always use light appearance' },
  { mode: 'dark', label: 'Dark', description: 'Always use dark appearance' },
  { mode: 'protos-nexus', label: 'PROTOS NEXUS ✦', description: 'Exclusive postmodern neon appearance' },
];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.bg },
    body: { padding: spacing.xxl, paddingBottom: 48 },
    section: { marginBottom: 28 },
    sectionTitle: {
      color: colors.textFaint,
      fontSize: 11,
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: spacing.md,
    },
    appearanceCard: {
      borderRadius: radius.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.borderStrong,
      backgroundColor: colors.surfaceAlt,
    },
    appearanceOption: {
      minHeight: 58,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    appearanceDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.borderStrong,
    },
    appearanceCopy: { flex: 1 },
    appearanceLabel: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600' },
    nexusLabel: { color: colors.premiumTier },
    appearanceDescription: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
    nexusMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4 },
    premiumBadge: {
      borderWidth: 1,
      borderColor: colors.premiumBorder,
      backgroundColor: colors.premiumSoft,
      borderRadius: radius.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
    },
    premiumBadgeText: { color: colors.premiumTier, fontSize: 10, fontWeight: '800', letterSpacing: 0.7 },
    lockedText: { color: colors.textFaint, fontSize: fontSize.xs },
    radioOuter: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: { borderColor: colors.primary },
    radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
    nexusLock: { color: colors.premiumTier, fontSize: fontSize.md, fontWeight: '800' },
    rowSpaced: { marginTop: spacing.md },
    standingCard: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.md,
      padding: spacing.lg,
      borderWidth: 1,
      borderColor: colors.borderStrong,
    },
    standingWarn: { borderColor: colors.warning },
    standingDanger: { borderColor: colors.danger },
    standingTitle: { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700' },
    standingBody: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4, lineHeight: 18 },
    logoutBtn: {
      marginTop: spacing.lg,
      backgroundColor: colors.surfaceAlt,
      borderRadius: 10,
      padding: spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.dangerSurface,
    },
    logoutText: { color: colors.dangerMuted, fontWeight: '600', fontSize: fontSize.md },
    deleteBtn: {
      marginTop: spacing.md,
      borderRadius: 10,
      padding: spacing.lg,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.dangerBorder,
    },
    deleteText: { color: colors.danger, fontWeight: '700', fontSize: fontSize.md },
    version: { textAlign: 'center', color: colors.textFaint, fontSize: fontSize.xs, marginTop: spacing.md },
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
      borderColor: colors.dangerSurface,
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
    modalError: { color: colors.dangerMuted, fontSize: fontSize.sm, marginTop: 10 },
    modalActions: { flexDirection: 'row', marginTop: 20, gap: spacing.md },
    modalBtn: { flex: 1, borderRadius: 10, padding: 14, alignItems: 'center' },
    modalCancel: { backgroundColor: colors.borderStrong },
    modalCancelText: { color: colors.textPrimary, fontWeight: '600', fontSize: fontSize.md },
    modalConfirm: { backgroundColor: colors.dangerSolid },
    modalConfirmText: { color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.md },
  });
}

export function SettingsScreen(): React.JSX.Element {
  const { colors, mode, setMode, canUseProtosNexus } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

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
  const standing = strikeStanding({
    strikePoints: profile?.strikePoints ?? 0,
    storySuspendedUntil: profile?.storySuspendedUntil ?? null,
    verification: profile?.verification ?? 'none',
  });
  const trustNext = resolveTrustNextStep({
    emailVerified: profile?.badges?.email === true,
    phoneVerified: profile?.badges?.phone === true,
    ...(profile?.idVerificationStatus != null ? { idStatus: profile.idVerificationStatus } : {}),
  });
  const trustActionLabel = resolveNexaTrustActionLabel(
    trustNext,
    profile?.idVerificationStatus,
  );

  useFocusEffect(
    useCallback(() => {
      if (!profile) void dispatch(fetchProfile());
    }, [dispatch, profile]),
  );

  const toggleVisibility = async (): Promise<void> => {
    if (toggling || !profile) return;
    setToggling(true);
    try {
      const result = await dispatch(updateProfile({ visibility: isVisible ? 'private' : 'public' }));
      if (updateProfile.rejected.match(result)) appAlert('Could not update', (result.payload as string) || 'Try again.');
    } finally {
      setToggling(false);
    }
  };

  const toggleFriendsOnline = async (): Promise<void> => {
    if (togglingOnline || !profile) return;
    setTogglingOnline(true);
    try {
      const result = await dispatch(updateProfile({ friendsSeeOnlineStatus: !friendsSeeOnline }));
      if (updateProfile.rejected.match(result)) appAlert('Could not update', (result.payload as string) || 'Try again.');
    } finally {
      setTogglingOnline(false);
    }
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
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.appearanceCard} accessibilityRole="radiogroup">
            {THEME_OPTIONS.map((option, index) => {
              const isNexus = option.mode === 'protos-nexus';
              const locked = isNexus && canUseProtosNexus === false;
              const selected = mode === option.mode;
              const handlePress = (): void => {
                if (locked) {
                  navigation.navigate('Subscription');
                  return;
                }
                setMode(option.mode);
              };

              return (
                <TouchableOpacity
                  key={option.mode}
                  style={[styles.appearanceOption, index > 0 ? styles.appearanceDivider : undefined]}
                  onPress={handlePress}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={locked ? `${option.label} appearance. Premium membership required.` : `${option.label} appearance`}
                  accessibilityHint={locked ? 'Opens Premium membership options' : undefined}
                >
                  <View style={styles.appearanceCopy}>
                    <Text style={[styles.appearanceLabel, isNexus ? styles.nexusLabel : undefined]}>{option.label}</Text>
                    <Text style={styles.appearanceDescription}>{option.description}</Text>
                    {isNexus ? (
                      <View style={styles.nexusMeta}>
                        <View style={styles.premiumBadge}>
                          <Text style={styles.premiumBadgeText}>PREMIUM</Text>
                        </View>
                        {locked ? <Text style={styles.lockedText}>Tap to unlock</Text> : null}
                      </View>
                    ) : null}
                  </View>
                  {locked ? (
                    <Text style={styles.nexusLock} accessibilityElementsHidden importantForAccessibility="no">✦</Text>
                  ) : (
                    <View style={[styles.radioOuter, selected ? styles.radioOuterSelected : undefined]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Discovery</Text>
          <ListRow
            title="Appear on map"
            subtitle={isVisible ? 'Others can see you nearby on the map' : 'Hidden from discovery — you can still browse'}
            trailing={toggling ? <ActivityIndicator color={colors.primary} /> : (
              <Switch value={isVisible} onValueChange={toggleVisibility} trackColor={{ false: colors.borderStrong, true: colors.primaryTrack }} thumbColor={isVisible ? colors.primary : colors.textFaint} accessibilityLabel="Appear on map" />
            )}
            accessibilityLabel="Appear on map"
          />
          <ListRow
            style={styles.rowSpaced}
            title="Friends can see when I am online"
            subtitle={friendsSeeOnline ? 'Close friends see you online in chat and the friends list' : 'Hidden from friends — you still appear in lists without a green dot'}
            trailing={togglingOnline ? <ActivityIndicator color={colors.primary} /> : (
              <Switch value={friendsSeeOnline} onValueChange={toggleFriendsOnline} trackColor={{ false: colors.borderStrong, true: colors.primaryTrack }} thumbColor={friendsSeeOnline ? colors.primary : colors.textFaint} accessibilityLabel="Friends can see when I am online" />
            )}
            accessibilityLabel="Friends can see when I am online"
          />
          <ListRow style={styles.rowSpaced} title="Blocked users" subtitle="Hidden from map, chat, waves, and friend requests" onPress={() => navigation.navigate('BlockedUsers')} />
        </View>

        {standing.level !== 'clear' ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Standing</Text>
            <View style={[styles.standingCard, standing.level === 'suspended' ? styles.standingDanger : undefined, standing.level === 'phone_required' ? styles.standingWarn : undefined]} accessibilityRole="summary">
              <Text style={styles.standingTitle}>{standing.title}</Text>
              <Text style={styles.standingBody}>{standing.body}</Text>
              {standing.level === 'phone_required' ? <ListRow style={styles.rowSpaced} title="Verify phone" subtitle="Unlocks story posting after elevated strikes" onPress={() => navigation.navigate('Verification')} /> : null}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trust & posting</Text>
          <ListRow title="Trust" subtitle={trustNext.kind === 'done' ? 'Identity verified · Email · Phone · ID' : trustNext.kind === 'pending' ? trustNext.detail : `Next: ${trustNext.title} · ${trustNext.detail}`} onPress={() => navigation.navigate('TrustCenter')} />
          {trustNext.kind === 'actionable' && trustNext.nav && trustActionLabel ? (
            <ListRow style={styles.rowSpaced} title={trustActionLabel} subtitle={trustNext.detail} onPress={() => {
              if (trustNext.nav === 'EmailVerification') navigation.navigate('EmailVerification');
              else if (trustNext.nav === 'VerificationId') navigation.navigate('VerificationId');
              else navigation.navigate('Verification');
            }} />
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected accounts</Text>
          <ListRow title="Social accounts" subtitle="Optional supporting identity signals — not a substitute for ID verification" onPress={() => navigation.navigate('SocialLinking')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <ListRow title="Edit profile" subtitle="Name, bio, hometown, age visibility" onPress={() => navigation.navigate('ProfileEdit')} />
          <ListRow style={styles.rowSpaced} title="Manage photos" subtitle="Gallery order and cover photo" onPress={() => navigation.navigate('Photos')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <ListRow title="Push notifications" subtitle="Waves, friend requests, chats, stories, trades, and more" onPress={() => navigation.navigate('NotificationSettings')} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <ListRow title="Privacy" subtitle="Policy and how we handle your data" onPress={() => navigation.navigate('Privacy')} />
          <ListRow style={styles.rowSpaced} title="Terms of Service" subtitle="Rules for using NEXA" onPress={() => void Linking.openURL(TERMS_OF_SERVICE_URL)} />
          <ListRow style={styles.rowSpaced} title="Help & Support" subtitle="FAQ and contact" onPress={() => navigation.navigate('Help')} />
          <ListRow style={styles.rowSpaced} title="About" subtitle="Version and product overview" onPress={() => navigation.navigate('About')} />

          <TouchableOpacity style={styles.logoutBtn} onPress={() => void dispatch(logout())} accessibilityRole="button" accessibilityLabel="Log out">
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.deleteBtn} onPress={() => { setDeletePassword(''); setDeleteOpen(true); }} accessibilityRole="button" accessibilityLabel="Delete account">
            <Text style={styles.deleteText}>Delete account</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Version {APP_VERSION}</Text>
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="fade" onRequestClose={() => setDeleteOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete account?</Text>
            <Text style={styles.modalBody}>This permanently deletes your profile, photos, stories, messages, friends, and activity. It cannot be undone.</Text>
            <TextInput style={styles.input} value={deletePassword} onChangeText={setDeletePassword} placeholder="Password (if you signed up with email)" placeholderTextColor={colors.textFaint} secureTextEntry autoCapitalize="none" editable={!authLoading} />
            {authError ? <Text style={styles.modalError}>{authError}</Text> : null}
            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalBtn, styles.modalCancel]} onPress={() => setDeleteOpen(false)} disabled={authLoading}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalConfirm]} onPress={confirmDelete} disabled={authLoading}>
                {authLoading ? <ActivityIndicator color={colors.textPrimary} /> : <Text style={styles.modalConfirmText}>Delete</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}