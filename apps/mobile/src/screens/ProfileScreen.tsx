import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile, updateProfile } from '@/features/profile/profileSlice';
import { logout } from '@/features/auth/authSlice';
import { useGamification } from '@/features/gamification/useGamification';
import { useChallenges } from '@/features/gamification/useChallenges';
import { useGiftBalance } from '@/features/gifts/useGifts';
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';
import { APP_VERSION } from '@/constants/app';
import { SOCIAL_PROVIDER_CONFIG, TIER_LABEL } from '@/features/profile/socialConfig';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';
import { ProfileHeaderPhoto } from '@/components/Profile/ProfileHeaderPhoto';
import { MapPresenceCard } from '@/components/Profile/MapPresenceCard';
import { TrustStrip, type TrustChip } from '@/components/Profile/TrustStrip';
import { colors, spacing, radius, fontSize } from '@/theme';
import type {
  GamificationSummary,
  ChallengeToday,
  UserProfile,
} from '@g88/shared';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

function ProgressCard({ summary }: { summary: GamificationSummary }): React.JSX.Element {
  const pct =
    summary.xpForNextLevel > 0
      ? Math.min(100, Math.round((summary.xpIntoLevel / summary.xpForNextLevel) * 100))
      : 0;
  return (
    <View style={styles.card}>
      <View style={styles.progressRow}>
        <Text style={styles.levelText}>Level {summary.level}</Text>
        <Text style={styles.xpText}>{summary.totalXp.toLocaleString()} XP</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.subText}>
          {summary.xpIntoLevel}/{summary.xpForNextLevel} to Lvl {summary.level + 1}
        </Text>
        {summary.currentStreak > 0 ? (
          <Text style={styles.streakText}>🔥 {summary.currentStreak}-day streak</Text>
        ) : null}
      </View>
    </View>
  );
}

function ChallengesCard({ challenges }: { challenges: ChallengeToday[] }): React.JSX.Element {
  return (
    <View style={[styles.card, styles.cardSpaced]}>
      <Text style={styles.cardHeader}>Today's challenges</Text>
      {challenges.map((c) => (
        <View key={c.id} style={styles.challengeRow}>
          <Text style={[styles.checkbox, c.completed && styles.checkboxDone]}>
            {c.completed ? '☑' : '☐'}
          </Text>
          <Text style={[styles.challengeTitle, c.completed && styles.challengeTitleDone]}>
            {c.title}
          </Text>
          <Text style={styles.challengeReward}>
            {c.completed ? `+${c.rewardXp}` : String(c.progress) + '/' + String(c.target)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ProfileScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const { profile, loading, error, saving } = useAppSelector((s) => s.profile);
  const { summary: gamification, refresh: refreshGamification } = useGamification();
  const { challenges, refresh: refreshChallenges } = useChallenges();
  const { spendableXp, refresh: refreshGiftBalance } = useGiftBalance();
  const [refreshing, setRefreshing] = useState(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  const reload = useCallback(() => {
    void dispatch(fetchProfile());
    refreshGamification();
    refreshChallenges();
    refreshGiftBalance();
  }, [dispatch, refreshGamification, refreshChallenges, refreshGiftBalance]);

  useFocusEffect(useCallback(() => reload(), [reload]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await dispatch(fetchProfile());
    refreshGamification();
    refreshChallenges();
    setRefreshing(false);
  }, [dispatch, refreshGamification, refreshChallenges]);

  const handleLogout = useCallback(() => {
    void dispatch(logout());
  }, [dispatch]);

  const trustChips: TrustChip[] = useMemo(() => {
    if (!profile) return [];
    const badges = profile.badges ?? {
      email: false,
      phone: false,
      photo: false,
      id: false,
      social: false,
      premium: false,
      verified: false,
    };
    const verificationScore = profile.verificationScore ?? 0;
    const chips: TrustChip[] = [];
    chips.push({
      id: 'email',
      label: badges.email ? 'Email ✓' : 'Email',
      status: badges.email ? 'success' : 'missing',
    });
    const idStatus =
      profile.idVerificationStatus === 'verified'
        ? 'success'
        : profile.idVerificationStatus === 'pending'
          ? 'pending'
          : profile.idVerificationStatus === 'rejected'
            ? 'error'
            : 'missing';
    const idLabel =
      profile.idVerificationStatus === 'verified'
        ? 'ID Verified ✓'
        : profile.idVerificationStatus === 'pending'
          ? 'ID Under review'
          : profile.idVerificationStatus === 'rejected'
            ? 'ID Rejected'
            : 'ID Verification';
    chips.push({ id: 'id', label: idLabel, status: idStatus });
    chips.push({
      id: 'percent',
      label: `${verificationScore}% Verified`,
      status: verificationScore >= 100 ? 'success' : verificationScore > 0 ? 'pending' : 'missing',
    });
    return chips;
  }, [profile]);

  // Redux applies visibility optimistically on updateProfile.pending.
  const mapVisible = profile ? profile.visibility !== 'private' : true;

  const handleMapToggle = useCallback(
    (value: boolean) => {
      void dispatch(updateProfile({ visibility: value ? 'public' : 'private' }));
    },
    [dispatch],
  );

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color={colors.primary} />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={[styles.container, styles.centerFill]}>
        <Icon name="alert-circle-outline" size={48} color={colors.textFaint} />
        <Text style={styles.errorTitle}>Couldn't load your profile</Text>
        <Text style={styles.errorMsg}>{error ?? 'Something went wrong. Please try again.'}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void dispatch(fetchProfile())}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={{ marginTop: 8 }}>
          <Text style={styles.errorLogout}>Log out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const p: UserProfile = profile;
  const photoUrls = p.photoUrls ?? [];
  const interests = p.interests ?? [];
  const goals = p.goals ?? [];
  const socialLinks = p.socialLinks ?? [];
  const badges = p.badges ?? {
    email: false, phone: false, photo: false, id: false, social: false, premium: false, verified: false,
  };
  const tier = p.subscriptionTier ?? 'free';
  const verificationScore = p.verificationScore ?? 0;
  const photos = photoUrls.length > 0 ? photoUrls : p.avatarUrl ? [p.avatarUrl] : [];
  const mainPhoto = photos[activePhotoIndex] ?? p.avatarUrl;
  const isPaid = tier !== 'free';
  const showIdCta = p.idVerificationStatus !== 'verified';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <ProfileHeaderPhoto
        photoUrl={mainPhoto ?? null}
        displayName={p.displayName + (p.age ? `, ${p.age}` : '')}
        verificationPercent={verificationScore}
        isVisibleOnMap={mapVisible}
        isPaid={isPaid}
        tierLabel={TIER_LABEL[tier]}
        photoCount={photos.length}
        activePhotoIndex={activePhotoIndex}
        onSelectPhoto={setActivePhotoIndex}
        onPressSettings={() => navigation.navigate('Settings')}
        onPressVerificationBadge={() => navigation.navigate('Verification')}
        onPressPhoto={() => navigation.navigate('Photos')}
      />

      <View style={styles.trustSection}>
        <TrustStrip
          chips={trustChips}
          onChipPress={(id) => {
            if (id === 'id' || id === 'percent') {
              navigation.navigate(
                p.idVerificationStatus === 'pending' ? 'VerificationId' : 'Verification',
              );
            }
          }}
        />
      </View>

      <View style={styles.mapPresenceSection}>
        <MapPresenceCard
          isVisible={mapVisible}
          saving={saving}
          onToggle={handleMapToggle}
          onViewPin={() => navigation.navigate('Main', { screen: 'Map', params: { focusMyPin: true } })}
        />
      </View>

      {showIdCta ? (
        <View style={styles.sectionPadded}>
          <TouchableOpacity
            style={styles.idCta}
            onPress={() => navigation.navigate('VerificationId')}
            activeOpacity={0.85}
          >
            <View style={styles.idCtaLeft}>
              <Icon name="card-account-details" size={20} color={colors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.idCtaTitle}>
                  {p.idVerificationStatus === 'pending'
                    ? 'ID under review'
                    : p.idVerificationStatus === 'rejected'
                      ? 'ID rejected — resubmit'
                      : 'Verify your ID'}
                </Text>
                <Text style={styles.idCtaSub}>
                  {p.idVerificationStatus === 'pending'
                    ? 'We’ll notify you when it’s done'
                    : 'Boost trust and unlock more reach'}
                </Text>
              </View>
            </View>
            <Icon name="chevron-right" size={22} color={colors.textFaint} />
          </TouchableOpacity>
        </View>
      ) : null}

      {p.bio ? (
        <View style={styles.bioSection}>
          <Text style={styles.bio}>{p.bio}</Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ProfileEdit')}>
          <Icon name="pencil" size={18} color={colors.textPrimary} />
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Photos')}>
          <Icon name="image-multiple" size={18} color={colors.textPrimary} />
          <Text style={styles.actionButtonText}>Photos</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Verification')}>
          <Icon name="shield-check" size={18} color={colors.textPrimary} />
          <Text style={styles.actionButtonText}>Trust</Text>
        </TouchableOpacity>
      </View>

      {gamification ? (
        <View style={styles.sectionPadded}>
          <Text style={styles.blockLabel}>Activity</Text>
          <ProgressCard summary={gamification} />
          {challenges.length > 0 ? <ChallengesCard challenges={challenges} /> : null}
        </View>
      ) : null}

      <View style={styles.gamificationRow}>
        <TouchableOpacity style={styles.gamificationCard} onPress={() => navigation.navigate('Challenges')}>
          <Icon name="checkbox-marked-circle-outline" size={24} color={colors.primary} />
          <Text style={styles.gamificationTitle}>Challenges</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gamificationCard} onPress={() => navigation.navigate('Leaderboard')}>
          <Icon name="podium-gold" size={24} color="#FFD700" />
          <Text style={styles.gamificationTitle}>Ranks</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gamificationCard} onPress={() => navigation.navigate('Achievements')}>
          <Icon name="trophy" size={24} color="#E91E63" />
          <Text style={styles.gamificationTitle}>Badges</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.giftsCard} onPress={() => navigation.navigate('GiftsInbox')}>
        <Icon name="gift" size={22} color="#E91E63" />
        <View style={styles.giftsCardBody}>
          <Text style={styles.giftsCardTitle}>Gifts</Text>
          <Text style={styles.giftsCardSubtitle}>{spendableXp.toLocaleString()} XP · inbox</Text>
        </View>
        <Icon name="chevron-right" size={22} color={colors.textFaint} />
      </TouchableOpacity>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Photos')}>
            <Text style={styles.sectionAction}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.photoGrid}>
          {photos.map((photo, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => setActivePhotoIndex(index)}
              style={[styles.gridPhoto, index === activePhotoIndex && styles.gridPhotoActive]}
            >
              <Image source={{ uri: photo }} style={styles.gridPhotoImage} />
            </TouchableOpacity>
          ))}
          {photos.length < 6 ? (
            <TouchableOpacity style={styles.addPhotoButton} onPress={() => navigation.navigate('Photos')}>
              <Icon name="plus" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {p.id ? (
        <View style={styles.section}>
          <ProfileStoryline userId={p.id} isSelf />
        </View>
      ) : null}

      {interests.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.tagsContainer}>
            {interests.map((interest, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {goals.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Looking for</Text>
          <View style={styles.tagsContainer}>
            {goals.map((goal, index) => {
              const cfg = GOAL_OPTIONS.find((g) => g.value === goal);
              return (
                <View key={index} style={styles.goalTag}>
                  <Text style={styles.goalIcon}>{cfg?.icon ?? '🎯'}</Text>
                  <Text style={styles.goalText}>{cfg?.label ?? goal}</Text>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Icon name="email-outline" size={20} color={colors.textMuted} />
            <Text style={styles.infoText}>{p.email}</Text>
            <Icon
              name={badges.email ? 'check-circle' : 'circle-outline'}
              size={18}
              color={badges.email ? colors.success : colors.borderStrong}
            />
          </View>
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Icon name="phone-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.infoText, !p.phone && styles.infoTextMuted]}>
              {p.phone ?? 'No phone added'}
            </Text>
            {p.phone ? (
              <Icon
                name={badges.phone ? 'check-circle' : 'circle-outline'}
                size={18}
                color={badges.phone ? colors.success : colors.borderStrong}
              />
            ) : (
              <TouchableOpacity onPress={() => navigation.navigate('Verification')}>
                <Text style={styles.sectionAction}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Connected accounts</Text>
          <TouchableOpacity onPress={() => navigation.navigate('SocialLinking')}>
            <Text style={styles.sectionAction}>Manage</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.infoCard}>
          {socialLinks.length > 0 ? (
            socialLinks.map((link, index) => {
              const cfg = SOCIAL_PROVIDER_CONFIG[link.provider];
              const last = index === socialLinks.length - 1;
              return (
                <View key={index} style={[styles.socialLinkItem, last && styles.infoRowLast]}>
                  <View style={[styles.socialIcon, { backgroundColor: cfg.color }]}>
                    <Icon name={cfg.icon} size={18} color="#fff" />
                  </View>
                  <View style={styles.socialLinkInfo}>
                    <Text style={styles.socialLinkName}>{cfg.label}</Text>
                    {link.username ? (
                      <Text style={styles.socialLinkUsername}>@{link.username}</Text>
                    ) : null}
                  </View>
                  {link.verified ? <Icon name="check-circle" size={18} color={colors.success} /> : null}
                </View>
              );
            })
          ) : (
            <TouchableOpacity
              style={styles.connectSocialButton}
              onPress={() => navigation.navigate('SocialLinking')}
            >
              <Icon name="link-plus" size={22} color={colors.primary} />
              <Text style={styles.connectSocialText}>Connect social accounts</Text>
              <Text style={styles.connectSocialSubtext}>Boost your trust score</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {!isPaid ? (
        <TouchableOpacity style={styles.upgradeCard} onPress={() => navigation.navigate('Subscription')}>
          <View style={styles.upgradeContent}>
            <Icon name="crown" size={26} color="#FFD700" />
            <View style={styles.upgradeText}>
              <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={styles.upgradeSubtitle}>More reach · who viewed you</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={22} color={colors.textMuted} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.menuSection}>
        {(
          [
            { label: 'Settings', icon: 'cog', route: 'Settings' as const },
            { label: 'Privacy', icon: 'shield-lock', route: 'Privacy' as const },
            { label: 'Help & Support', icon: 'help-circle', route: 'Help' as const },
            { label: 'About', icon: 'information', route: 'About' as const },
          ]
        ).map((item, index, arr) => (
          <TouchableOpacity
            key={item.route}
            style={[styles.menuItem, index === arr.length - 1 && styles.infoRowLast]}
            onPress={() => navigation.navigate(item.route)}
          >
            <Icon name={item.icon} size={20} color={colors.textMuted} />
            <Text style={styles.menuItemText}>{item.label}</Text>
            <Icon name="chevron-right" size={20} color={colors.borderStrong} />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={18} color={colors.danger} />
        <Text style={styles.logoutText}>Log out</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version {APP_VERSION}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  centerFill: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  errorTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 8 },
  errorMsg: { color: colors.textMuted, fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  errorLogout: { color: colors.textMuted, fontSize: 14, fontWeight: '600' },
  trustSection: { marginTop: spacing.md },
  mapPresenceSection: { marginTop: spacing.sm },
  sectionPadded: { paddingHorizontal: spacing.xl, marginTop: spacing.md },
  blockLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  idCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255, 157, 60, 0.25)',
  },
  idCtaLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  idCtaTitle: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  idCtaSub: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  bioSection: { paddingHorizontal: spacing.xl, marginTop: spacing.md },
  bio: { fontSize: 15, color: colors.textSecondary, lineHeight: 22 },
  actionsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 12,
    borderRadius: radius.md,
  },
  actionButtonText: { color: colors.textPrimary, fontWeight: '600', fontSize: 13 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  cardSpaced: { marginTop: 12, gap: 10 },
  cardHeader: { color: colors.textPrimary, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelText: { color: colors.textPrimary, fontSize: 16, fontWeight: '700' },
  xpText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
  barTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: colors.primary, borderRadius: 4 },
  subText: { color: colors.textMuted, fontSize: 12 },
  streakText: { color: colors.warning, fontSize: 12, fontWeight: '600' },
  challengeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { color: colors.textFaint, fontSize: 18 },
  checkboxDone: { color: colors.primary },
  challengeTitle: { color: '#ddd', fontSize: 14, flex: 1 },
  challengeTitleDone: { color: colors.textMuted, textDecorationLine: 'line-through' },
  challengeReward: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  gamificationRow: { flexDirection: 'row', paddingHorizontal: spacing.xl, marginTop: spacing.md, gap: 10 },
  gamificationCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    paddingVertical: 14,
    borderRadius: radius.md,
    gap: 6,
  },
  gamificationTitle: { color: colors.textPrimary, fontWeight: '600', fontSize: 11 },
  giftsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: spacing.xl,
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
  },
  giftsCardBody: { flex: 1 },
  giftsCardTitle: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  giftsCardSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  section: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  sectionAction: { color: colors.primary, fontWeight: '600', fontSize: 14 },
  infoCard: { backgroundColor: colors.surfaceRaised, borderRadius: radius.md, overflow: 'hidden' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoText: { flex: 1, color: colors.textPrimary, fontSize: 15 },
  infoTextMuted: { color: colors.textMuted },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridPhotoActive: { borderColor: colors.primary },
  gridPhotoImage: { width: '100%', height: '100%' },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    backgroundColor: colors.surfaceRaised,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: {
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  tagText: { color: colors.textPrimary, fontSize: 14 },
  goalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceRaised,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.pill,
    gap: 8,
  },
  goalIcon: { fontSize: 16 },
  goalText: { color: colors.textPrimary, fontSize: 14, fontWeight: '500' },
  socialLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  socialIcon: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  socialLinkInfo: { flex: 1, marginLeft: 12 },
  socialLinkName: { color: colors.textPrimary, fontWeight: '600' },
  socialLinkUsername: { color: colors.textMuted, fontSize: 12 },
  connectSocialButton: { alignItems: 'center', padding: 20, gap: 6 },
  connectSocialText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  connectSocialSubtext: { color: colors.textMuted, fontSize: 12 },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#FFD70040',
  },
  upgradeContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeText: { flex: 1 },
  upgradeTitle: { color: '#FFD700', fontWeight: '700', fontSize: 15 },
  upgradeSubtitle: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  menuSection: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  menuItemText: { flex: 1, marginLeft: 12, color: colors.textPrimary, fontSize: 15 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    padding: 14,
    backgroundColor: 'rgba(255, 68, 68, 0.12)',
    borderRadius: radius.md,
  },
  logoutText: { color: colors.danger, fontWeight: '600', fontSize: 15 },
  version: { textAlign: 'center', color: colors.textFaint, marginVertical: spacing.xl, fontSize: fontSize.xs },
});
