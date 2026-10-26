// apps/mobile/src/screens/ProfileScreen.tsx
// Profile v3 — self identity surface, not a settings/dashboard duplicate.

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { VerificationBadge } from '@/components/VerificationBadge';
import { ProfileErrorState, ProfileLoadingState } from '@/components/Profile/ProfileScreenStates';
import { ProfileTagsSection } from '@/components/Profile/ProfileTagsSection';
import { fetchPendingCount, pendingCountSet } from '@/features/friends/friendsSlice';
import {
  buildNexaProfileIdentityLine,
  countVerifiedProfileSignals,
  formatNexaProfileActivitySummary,
  formatNexaProfileTrustSummary,
} from '@/features/profile/nexaProfileIdentity';
import { fetchProfile } from '@/features/profile/profileSlice';
import { useProfileScreenData } from '@/features/profile/useProfileScreenData';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';
import { useAppSelector } from '@/hooks/redux';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { openTrustCenter } from '@/navigation/openTrust';
import { useSocket } from '@/realtime/useSocket';
import { spacing, useAppTheme, type ThemeColors } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type ProfileRowTone = 'action' | 'discovery' | 'premium';

function zodiacFromDateOfBirth(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const [, monthRaw, dayRaw] = isoDate.split('-');
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!Number.isInteger(month) || !Number.isInteger(day)) return null;

  const zodiac: Array<{ until: [number, number]; name: string }> = [
    { until: [1, 19], name: 'Capricorn' },
    { until: [2, 18], name: 'Aquarius' },
    { until: [3, 20], name: 'Pisces' },
    { until: [4, 19], name: 'Aries' },
    { until: [5, 20], name: 'Taurus' },
    { until: [6, 20], name: 'Gemini' },
    { until: [7, 22], name: 'Cancer' },
    { until: [8, 22], name: 'Leo' },
    { until: [9, 22], name: 'Virgo' },
    { until: [10, 22], name: 'Libra' },
    { until: [11, 21], name: 'Scorpio' },
    { until: [12, 21], name: 'Sagittarius' },
    { until: [12, 31], name: 'Capricorn' },
  ];

  return zodiac.find(({ until }) => month < until[0] || (month === until[0] && day <= until[1]))?.name ?? null;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.canvas },
    content: { paddingBottom: spacing.xxl },
    hero: { height: 158, backgroundColor: colors.surfacePrimary, overflow: 'hidden', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.borderSubtle },
    heroGlowAction: { position: 'absolute', width: 220, height: 220, borderRadius: 110, right: -72, top: -100, backgroundColor: colors.actionGhost },
    heroGlowDiscovery: { position: 'absolute', width: 170, height: 170, borderRadius: 85, left: -72, bottom: -118, backgroundColor: colors.discoverySoft },
    heroHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: spacing.xl },
    heroCopy: { flex: 1, paddingRight: spacing.md },
    eyebrow: { color: colors.actionPrimary, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
    heroTitle: { color: colors.textPrimary, fontSize: 30, fontWeight: '900', letterSpacing: -0.8, marginTop: 2 },
    heroSub: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
    settingsBtn: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.borderDefault },
    avatarWrap: { alignItems: 'center', marginTop: -48 },
    avatarRing: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.actionPrimary, backgroundColor: colors.canvas, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    avatarImg: { width: 92, height: 92, borderRadius: 46 },
    avatarPlaceholder: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
    identityBlock: { alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.md },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    name: { color: colors.textPrimary, fontSize: 23, fontWeight: '800' },
    subtitle: { color: colors.textSecondary, fontSize: 14, marginTop: 5, textAlign: 'center' },
    summaryCard: { marginTop: spacing.lg, marginHorizontal: spacing.xl, flexDirection: 'row', backgroundColor: colors.surfaceSecondary, borderRadius: 18, borderWidth: 1, borderColor: colors.borderDefault, overflow: 'hidden' },
    summaryCell: { flex: 1, minHeight: 74, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
    summaryDivider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.borderStrong },
    summaryValue: { color: colors.textPrimary, fontSize: 18, fontWeight: '800' },
    summaryLabel: { color: colors.textTertiary, fontSize: 11, fontWeight: '700', marginTop: 3 },
    sectionHeader: { marginTop: spacing.xl, marginHorizontal: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    sectionTitle: { color: colors.textPrimary, fontSize: 17, fontWeight: '800' },
    sectionEdit: { minWidth: 36, minHeight: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.surfaceSecondary },
    aboutCard: { marginTop: spacing.sm, marginHorizontal: spacing.xl, padding: spacing.lg, borderRadius: 18, backgroundColor: colors.surfacePrimary, borderWidth: 1, borderColor: colors.borderSubtle },
    bioText: { color: colors.textPrimary, fontSize: 15, lineHeight: 22 },
    bioEmpty: { color: colors.textTertiary, fontSize: 14, fontStyle: 'italic' },
    detailsWrap: { marginTop: spacing.md, gap: 8 },
    detailRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    detailText: { color: colors.textSecondary, fontSize: 13, flex: 1 },
    tagsWrap: { marginHorizontal: 0 },
    sectionLabel: { marginTop: spacing.xl, marginBottom: 2, marginHorizontal: spacing.xl, color: colors.textTertiary, fontSize: 11, fontWeight: '800', letterSpacing: 1.1, textTransform: 'uppercase' },
    listRow: { minHeight: 64, marginTop: spacing.sm, marginHorizontal: spacing.xl, backgroundColor: colors.surfacePrimary, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.borderSubtle },
    listIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    listBody: { flex: 1, minWidth: 0 },
    listTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
    listSub: { color: colors.textTertiary, fontSize: 12, marginTop: 2, lineHeight: 17 },
    storylineWrap: { marginTop: spacing.sm, marginHorizontal: spacing.md, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surfacePrimary, borderWidth: 1, borderColor: colors.borderSubtle },
    verificationCard: { marginTop: spacing.sm, marginHorizontal: spacing.xl, padding: spacing.md, borderRadius: 18, backgroundColor: colors.discoverySoft, borderWidth: 1, borderColor: colors.discoveryBorderSoft },
    verificationHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
    verificationTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    verificationTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '800' },
    verificationBody: { color: colors.textSecondary, fontSize: 12, marginTop: 4, lineHeight: 17 },
    verificationCopy: { flex: 1 },
    manageTrustBtn: { minHeight: 36, paddingHorizontal: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.discoveryMutedBg, borderWidth: 1, borderColor: colors.discoveryBorder },
    manageTrustText: { color: colors.discovery, fontSize: 12, fontWeight: '800' },
    signalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.md },
    signalPill: { minHeight: 30, paddingHorizontal: 10, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1 },
    signalPillOk: { backgroundColor: colors.discoveryMutedBg, borderColor: colors.discoveryBorderSoft },
    signalPillMissing: { backgroundColor: colors.surfacePrimary, borderColor: colors.borderDefault },
    signalText: { fontSize: 12, fontWeight: '700' },
    signalTextOk: { color: colors.discovery },
    signalTextMissing: { color: colors.textTertiary },
  });
}

function useProfileStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}

export function ProfileScreen(): React.JSX.Element {
  const { colors } = useAppTheme();
  const S = useProfileStyles();
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { on } = useSocket();
  const pendingCount = useAppSelector((s) => s.friends.pendingCount);
  const friendsCount = useAppSelector((s) => s.friends.friends.items.length);
  const myUserId = useAppSelector((s) => s.auth.user?.id ?? null);
  const { loading, error, refreshing, gamification, mapVisible, derived, onRefresh, dispatch } = useProfileScreenData();

  useEffect(() => { void dispatch(fetchPendingCount()); }, [dispatch]);
  useEffect(() => {
    const unsubReq = on('friend:request', (event) => dispatch(pendingCountSet(event.pendingCount)));
    return () => { unsubReq(); };
  }, [on, dispatch]);

  const identityLine = useMemo(() => {
    if (!derived) return '';
    return buildNexaProfileIdentityLine({
      hometownCity: derived.p.hometownCity,
      hometownCountry: derived.p.hometownCountry,
      interests: [],
    });
  }, [derived]);

  const trustStatus = useMemo(() => {
    if (!derived) return { email: false, phone: false, id: false };
    const badges = derived.badges;
    return {
      email: !!badges.email,
      phone: !!badges.phone,
      id: derived.p.idVerificationStatus === 'verified' || !!badges.id,
    };
  }, [derived]);

  const verifiedSignals = useMemo(() => countVerifiedProfileSignals(trustStatus), [trustStatus]);
  const trustSummary = useMemo(() => formatNexaProfileTrustSummary(trustStatus), [trustStatus]);
  const activityLine = useMemo(() => formatNexaProfileActivitySummary({ level: gamification?.level, currentStreak: gamification?.currentStreak }), [gamification]);
  const openTrust = useCallback(() => openTrustCenter(navigation), [navigation]);
  const openSettings = useCallback(() => openRootScreen(navigation, 'Settings'), [navigation]);
  const openEdit = useCallback(() => openRootScreen(navigation, 'ProfileEdit'), [navigation]);

  if (loading && !derived) return <ProfileLoadingState />;
  if (!derived) return <ProfileErrorState message={error ?? 'Could not load profile'} onRetry={() => void dispatch(fetchProfile())} />;

  const { p, mainPhoto, displayName, photos, tierLabel, isPaid } = derived;
  const nameOnly = p.displayName ?? displayName.split(',')[0] ?? 'You';
  const ageSuffix = p.age != null ? `, ${p.age}` : '';
  const bio = (p.bio ?? '').trim();
  const zodiac = zodiacFromDateOfBirth(p.dateOfBirth);
  const origin = [p.hometownCity, p.hometownCountry].filter(Boolean).join(', ');
  const photoCount = photos.length;
  const levelValue = gamification?.level != null ? `L${Math.max(0, Math.floor(gamification.level))}` : '—';

  return (
    <ScrollView
      style={S.container}
      contentContainerStyle={[S.content, { paddingBottom: spacing.xxl + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.actionPrimary} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={S.hero}>
        <View style={S.heroGlowAction} />
        <View style={S.heroGlowDiscovery} />
        <View style={[S.heroHeader, { paddingTop: insets.top + 14 }]}>
          <View style={S.heroCopy}>
            <Text style={S.eyebrow}>NEXA</Text>
            <Text style={S.heroTitle}>You</Text>
            <Text style={S.heroSub}>Your profile in your local world</Text>
          </View>
          <Pressable style={S.settingsBtn} onPress={openSettings} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8}>
            <MCI name="cog-outline" size={22} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <View style={S.avatarWrap}>
        <View style={S.avatarRing}>
          {mainPhoto ? <Image source={{ uri: mainPhoto }} style={S.avatarImg} /> : <View style={[S.avatarImg, S.avatarPlaceholder]}><MCI name="account" size={48} color={colors.textMuted} /></View>}
        </View>
      </View>

      <View style={S.identityBlock}>
        <View style={S.nameRow}>
          <Text style={S.name}>{nameOnly}{ageSuffix}</Text>
          <VerificationBadge verification={trustStatus.id || trustStatus.email || trustStatus.phone ? 'email' : 'none'} idVerified={trustStatus.id} size={18} />
        </View>
        {!!identityLine && <Text style={S.subtitle}>{identityLine}</Text>}
      </View>

      <View style={S.summaryCard} accessibilityLabel="Profile summary">
        <SummaryCell value={`${verifiedSignals}/3`} label="Signals" />
        <SummaryCell value={String(friendsCount)} label="Friends" divided />
        <SummaryCell value={levelValue} label="Level" divided />
      </View>

      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>About me</Text>
        <Pressable style={S.sectionEdit} onPress={openEdit} accessibilityRole="button" accessibilityLabel="Edit about me">
          <MCI name="pencil-outline" size={18} color={colors.actionPrimary} />
        </Pressable>
      </View>
      <View style={S.aboutCard}>
        {bio ? <Text style={S.bioText}>{bio}</Text> : <Text style={S.bioEmpty}>Add a short intro about yourself.</Text>}
        <View style={S.detailsWrap}>
          {p.age != null ? <Detail icon="cake-variant-outline" text={`${p.age}${zodiac ? ` · ${zodiac}` : ''}`} /> : zodiac ? <Detail icon="star-four-points-outline" text={zodiac} /> : null}
          {origin ? <Detail icon="map-marker-outline" text={`From ${origin}`} /> : null}
          {p.nationality ? <Detail icon="flag-outline" text={p.nationality} /> : null}
        </View>
      </View>

      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>Interests & Purpose</Text>
        <Pressable style={S.sectionEdit} onPress={openEdit} accessibilityRole="button" accessibilityLabel="Edit interests and purpose">
          <MCI name="pencil-outline" size={18} color={colors.actionPrimary} />
        </Pressable>
      </View>
      <View style={S.tagsWrap}>
        <ProfileTagsSection interests={p.interests ?? []} goals={p.goals ?? []} />
      </View>

      <Text style={S.sectionLabel}>Photos</Text>
      <ProfileListRow icon="image-multiple-outline" title="Photos" subtitle={photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'}` : 'Add photos'} tone="action" onPress={() => openRootScreen(navigation, 'Photos')} />

      <Text style={S.sectionLabel}>Activity</Text>
      {myUserId ? <View style={S.storylineWrap}><ProfileStoryline userId={myUserId} isSelf /></View> : null}
      <ProfileListRow icon="storefront-outline" title="Marketplace" subtitle="Your local listings and offers" tone="discovery" onPress={() => openRootScreen(navigation, 'Marketplace')} />
      {activityLine ? <ProfileListRow icon="medal-outline" title="Achievements" subtitle={activityLine} tone="action" onPress={() => openRootScreen(navigation, 'Achievements')} /> : null}

      <Text style={S.sectionLabel}>Connections</Text>
      <ProfileListRow icon="account-group-outline" title="Friends" subtitle={pendingCount > 0 ? `${friendsCount} friends · ${pendingCount} request${pendingCount === 1 ? '' : 's'}` : `${friendsCount} friends`} tone="action" onPress={() => openRootScreen(navigation, 'FriendsList')} />
      <ProfileListRow icon="map-marker-radius-outline" title="My map presence" subtitle={mapVisible ? 'Open your pin on the map' : 'Map visibility is private'} tone="discovery" onPress={() => navigation.navigate('Main', { screen: 'Map', params: { focusMyPin: true } })} />

      <Text style={S.sectionLabel}>Trust</Text>
      <View style={S.verificationCard}>
        <View style={S.verificationHeader}>
          <View style={S.verificationCopy}>
            <View style={S.verificationTitleRow}>
              <MCI name="shield-check-outline" size={20} color={colors.discovery} />
              <Text style={S.verificationTitle}>Verification</Text>
            </View>
            <Text style={S.verificationBody}>{trustSummary}</Text>
          </View>
          <Pressable style={S.manageTrustBtn} onPress={openTrust} accessibilityRole="button" accessibilityLabel="Open Trust Center">
            <Text style={S.manageTrustText}>Manage</Text>
          </Pressable>
        </View>
        <View style={S.signalRow}>
          <VerificationSignal label="Email" ok={trustStatus.email} />
          <VerificationSignal label="Phone" ok={trustStatus.phone} />
          <VerificationSignal label="ID" ok={trustStatus.id} />
        </View>
      </View>

      <Text style={S.sectionLabel}>Account</Text>
      <ProfileListRow icon={isPaid ? 'crown' : 'crown-outline'} title="Premium" subtitle={isPaid ? tierLabel : 'Unlock premium features'} tone="premium" onPress={() => openRootScreen(navigation, 'Subscription')} />
    </ScrollView>
  );

  function Detail({ icon, text }: { icon: string; text: string }): React.JSX.Element {
    return <View style={S.detailRow}><MCI name={icon} size={18} color={colors.textTertiary} /><Text style={S.detailText}>{text}</Text></View>;
  }

  function SummaryCell({ value, label, divided = false }: { value: string; label: string; divided?: boolean }): React.JSX.Element {
    return <View style={[S.summaryCell, divided && S.summaryDivider]}><Text style={S.summaryValue}>{value}</Text><Text style={S.summaryLabel}>{label}</Text></View>;
  }

  function VerificationSignal({ label, ok }: { label: string; ok: boolean }): React.JSX.Element {
    return <View style={[S.signalPill, ok ? S.signalPillOk : S.signalPillMissing]}><MCI name={ok ? 'check-circle' : 'circle-outline'} size={14} color={ok ? colors.discovery : colors.textTertiary} /><Text style={[S.signalText, ok ? S.signalTextOk : S.signalTextMissing]}>{label}</Text></View>;
  }

  function ProfileListRow({ icon, title, subtitle, tone, onPress }: { icon: string; title: string; subtitle: string; tone: ProfileRowTone; onPress: () => void }): React.JSX.Element {
    const toneColor = tone === 'premium' ? colors.premium : tone === 'discovery' ? colors.discovery : colors.actionPrimary;
    const toneBg = tone === 'premium' ? colors.premiumMutedBg : tone === 'discovery' ? colors.discoveryMutedBg : colors.actionSoft;
    return (
      <Pressable style={S.listRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${title}. ${subtitle}`}>
        <View style={[S.listIcon, { backgroundColor: toneBg }]}><MCI name={icon} size={21} color={toneColor} /></View>
        <View style={S.listBody}><Text style={S.listTitle}>{title}</Text><Text style={S.listSub}>{subtitle}</Text></View>
        <MCI name="chevron-right" size={22} color={colors.textMuted} />
      </Pressable>
    );
  }
}
