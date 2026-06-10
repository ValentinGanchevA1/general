import React, { useCallback, useState } from 'react';
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
import { fetchProfile } from '@/features/profile/profileSlice';
import { logout } from '@/features/auth/authSlice';
import { useGamification } from '@/features/gamification/useGamification';
import { useChallenges } from '@/features/gamification/useChallenges';
import { useGiftBalance } from '@/features/gifts/useGifts';
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';
import { SOCIAL_PROVIDER_CONFIG, TIER_COLOR, TIER_LABEL } from '@/features/profile/socialConfig';
import type {
  GamificationSummary,
  ChallengeToday,
  ProfileBadges,
  UserProfile,
} from '@g88/shared';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 48) / 3;

const BADGE_META: Array<{
  key: keyof ProfileBadges;
  icon: string;
  label: string;
  color: string;
}> = [
  { key: 'email', icon: 'email-check', label: 'Email', color: '#4CAF50' },
  { key: 'phone', icon: 'phone-check', label: 'Phone', color: '#2196F3' },
  { key: 'photo', icon: 'camera-account', label: 'Photo', color: '#9C27B0' },
  { key: 'id', icon: 'card-account-details', label: 'ID', color: '#FF9800' },
  { key: 'social', icon: 'link-variant', label: 'Social', color: '#E91E63' },
  { key: 'premium', icon: 'crown', label: 'Premium', color: '#FFD700' },
  { key: 'verified', icon: 'check-decagram', label: 'Verified', color: '#00d4ff' },
];

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
            {c.completed ? `+${c.rewardXp}` : `${c.progress}/${c.target}`}
          </Text>
        </View>
      ))}
    </View>
  );
}

function InitialsAvatar({ name }: { name: string }): React.JSX.Element {
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <View style={[styles.mainPhoto, styles.placeholderPhoto]}>
      <Text style={styles.placeholderInitials}>{initials || '?'}</Text>
    </View>
  );
}

export function ProfileScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const { profile, loading, error } = useAppSelector((s) => s.profile);
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

  if (loading && !profile) {
    return (
      <View style={styles.container}>
        <ActivityIndicator style={{ flex: 1 }} color="#00d4ff" />
      </View>
    );
  }
  if (!profile) {
    return (
      <View style={[styles.container, styles.centerFill]}>
        <Icon name="alert-circle-outline" size={48} color="#555" />
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
  // Defensive: tolerate a partial payload (e.g. an older backend) without crashing.
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
  const earnedBadges = BADGE_META.filter((b) => badges[b.key]);
  const isPaid = tier !== 'free';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00d4ff" />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.headerButton}>
          <Icon name="cog" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Main Photo */}
      <View style={styles.mainPhotoContainer}>
        {mainPhoto ? (
          <Image source={{ uri: mainPhoto }} style={styles.mainPhoto} />
        ) : (
          <InitialsAvatar name={p.displayName} />
        )}

        {isPaid ? (
          <View style={[styles.tierBadge, { backgroundColor: TIER_COLOR[tier] }]}>
            <Icon name="crown" size={14} color="#fff" />
            <Text style={styles.tierBadgeText}>{TIER_LABEL[tier]}</Text>
          </View>
        ) : null}

        {photos.length > 1 ? (
          <View style={styles.photoIndicators}>
            {photos.map((_, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.photoIndicator, index === activePhotoIndex && styles.photoIndicatorActive]}
                onPress={() => setActivePhotoIndex(index)}
              />
            ))}
          </View>
        ) : null}
      </View>

      {/* User Info */}
      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.displayName}>
            {p.displayName}
            {p.age ? `, ${p.age}` : ''}
          </Text>
          {/* Decagram means ID-verified — consistent with the map marker and the
              "Verified" badge row. (Not the same as the weaker email+phone score.) */}
          {p.verifiedBadge ? (
            <Icon name="check-decagram" size={24} color="#00d4ff" />
          ) : null}
        </View>

        {/* Verification Score */}
        <View style={styles.verificationRow}>
          <View style={styles.verificationBar}>
            <View style={[styles.verificationProgress, { width: `${verificationScore}%` }]} />
          </View>
          <Text style={styles.verificationText}>{verificationScore}% Verified</Text>
        </View>

        {/* Badges */}
        <View style={styles.badgesRow}>
          {earnedBadges.map((badge) => (
            <View key={badge.key} style={[styles.badge, { backgroundColor: badge.color + '20' }]}>
              <Icon name={badge.icon} size={16} color={badge.color} />
              <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
            </View>
          ))}
          {earnedBadges.length === 0 ? (
            <TouchableOpacity
              style={styles.verifyNowButton}
              onPress={() => navigation.navigate('Verification')}
            >
              <Icon name="shield-check" size={16} color="#00d4ff" />
              <Text style={styles.verifyNowText}>Get Verified</Text>
            </TouchableOpacity>
          ) : null}
        </View>

		  {/* ID Verification Card */}
		  <View style={styles.card}>
			  <View style={styles.rowBetween}>
				  <View>
					  <Text style={styles.cardTitle}>ID Verification</Text>
					  <Text style={styles.cardSubtitle}>
						  {p.idVerificationStatus === 'verified' ? 'Verified ✓' :
							  p.idVerificationStatus === 'pending' ? 'Under review' :
								  p.idVerificationStatus === 'rejected' ? 'Rejected – resubmit' : 'Not verified'}
					  </Text>
				  </View>
				  {p.idVerificationStatus !== 'verified' && (
					  <TouchableOpacity
						  style={styles.primaryBtn}
						  onPress={() => navigation.navigate('VerificationId')}
					  >
						  <Text style={styles.primaryBtnText}>
							  {p.idVerificationStatus === 'pending' ? 'Check status' : 'Verify now'}
						  </Text>
					  </TouchableOpacity>
				  )}
			  </View>
		  </View>

        {p.bio ? <Text style={styles.bio}>{p.bio}</Text> : null}

        {/* Map visibility */}
        <View style={styles.visibilityPill}>
          <Icon
            name={p.visibility === 'private' ? 'eye-off' : 'eye'}
            size={14}
            color="#00d4ff"
          />
          <Text style={styles.visibilityText}>
            {p.visibility === 'private' ? 'Invisible on map' : 'Visible on map'}
          </Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('ProfileEdit')}>
          <Icon name="pencil" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Verification')}>
          <Icon name="shield-check" size={20} color="#fff" />
          <Text style={styles.actionButtonText}>Verification</Text>
        </TouchableOpacity>
      </View>

      {/* Gamification — real XP / streak + today's challenges */}
      {gamification ? (
        <View style={styles.sectionPadded}>
          <ProgressCard summary={gamification} />
          {challenges.length > 0 ? <ChallengesCard challenges={challenges} /> : null}
        </View>
      ) : null}

      {/* Gamification shortcuts */}
      <View style={styles.gamificationRow}>
        <TouchableOpacity style={styles.gamificationCard} onPress={() => navigation.navigate('Challenges')}>
          <Icon name="checkbox-marked-circle-outline" size={28} color="#00d4ff" />
          <Text style={styles.gamificationTitle}>Challenges</Text>
          <Text style={styles.gamificationSubtitle}>Daily goals</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gamificationCard} onPress={() => navigation.navigate('Leaderboard')}>
          <Icon name="podium-gold" size={28} color="#FFD700" />
          <Text style={styles.gamificationTitle}>Leaderboard</Text>
          <Text style={styles.gamificationSubtitle}>Compete</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.gamificationCard} onPress={() => navigation.navigate('Achievements')}>
          <Icon name="trophy" size={28} color="#E91E63" />
          <Text style={styles.gamificationTitle}>Achievements</Text>
          <Text style={styles.gamificationSubtitle}>View badges</Text>
        </TouchableOpacity>
      </View>

      {/* Gifts — wallet balance + inbox */}
      <TouchableOpacity style={styles.giftsCard} onPress={() => navigation.navigate('GiftsInbox')}>
        <Icon name="gift" size={24} color="#E91E63" />
        <View style={styles.giftsCardBody}>
          <Text style={styles.giftsCardTitle}>Gifts</Text>
          <Text style={styles.giftsCardSubtitle}>{spendableXp.toLocaleString()} XP to spend · view inbox</Text>
        </View>
        <Icon name="chevron-right" size={24} color="#555" />
      </TouchableOpacity>

      {/* Contact / account info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Icon name="email-outline" size={20} color="#888" />
            <Text style={styles.infoText}>{p.email}</Text>
            <Icon
              name={badges.email ? 'check-circle' : 'circle-outline'}
              size={18}
              color={badges.email ? '#4CAF50' : '#444'}
            />
          </View>
          <View style={[styles.infoRow, styles.infoRowLast]}>
            <Icon name="phone-outline" size={20} color="#888" />
            <Text style={[styles.infoText, !p.phone && styles.infoTextMuted]}>
              {p.phone ?? 'No phone added'}
            </Text>
            {p.phone ? (
              <Icon
                name={badges.phone ? 'check-circle' : 'circle-outline'}
                size={18}
                color={badges.phone ? '#4CAF50' : '#444'}
              />
            ) : (
              <TouchableOpacity onPress={() => navigation.navigate('Verification')}>
                <Text style={styles.sectionAction}>Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* Photo Grid */}
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
              <Icon name="plus" size={24} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Interests */}
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

      {/* Goals */}
      {goals.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Looking For</Text>
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

      {/* Social Links */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Connected Accounts</Text>
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
                    <Icon name={cfg.icon} size={20} color="#fff" />
                  </View>
                  <View style={styles.socialLinkInfo}>
                    <Text style={styles.socialLinkName}>{cfg.label}</Text>
                    {link.username ? (
                      <Text style={styles.socialLinkUsername}>@{link.username}</Text>
                    ) : null}
                  </View>
                  {link.verified ? <Icon name="check-circle" size={18} color="#4CAF50" /> : null}
                </View>
              );
            })
          ) : (
            <TouchableOpacity
              style={styles.connectSocialButton}
              onPress={() => navigation.navigate('SocialLinking')}
            >
              <Icon name="link-plus" size={24} color="#00d4ff" />
              <Text style={styles.connectSocialText}>Connect Social Accounts</Text>
              <Text style={styles.connectSocialSubtext}>Boost your trust score</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Subscription */}
      {!isPaid ? (
        <TouchableOpacity style={styles.upgradeCard} onPress={() => navigation.navigate('Subscription')}>
          <View style={styles.upgradeContent}>
            <Icon name="crown" size={32} color="#FFD700" />
            <View style={styles.upgradeText}>
              <Text style={styles.upgradeTitle}>Upgrade to Premium</Text>
              <Text style={styles.upgradeSubtitle}>Unlock more reach, see who viewed you, and more</Text>
            </View>
          </View>
          <Icon name="chevron-right" size={24} color="#666" />
        </TouchableOpacity>
      ) : null}

      {/* Menu */}
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
            <Icon name={item.icon} size={24} color="#888" />
            <Text style={styles.menuItemText}>{item.label}</Text>
            <Icon name="chevron-right" size={24} color="#444" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Icon name="logout" size={20} color="#ff4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Version 1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  centerFill: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  errorTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 8 },
  errorMsg: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
  retryBtn: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#00d4ff',
    borderRadius: 10,
  },
  retryText: { color: '#000', fontWeight: '700', fontSize: 15 },
  errorLogout: { color: '#888', fontSize: 14, fontWeight: '600' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
  },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  headerButton: { padding: 8 },
  mainPhotoContainer: { width, height: width * 1.2, position: 'relative' },
  mainPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  placeholderPhoto: { backgroundColor: '#1a1a24', justifyContent: 'center', alignItems: 'center' },
  placeholderInitials: { color: '#00d4ff', fontSize: 72, fontWeight: '700' },
  tierBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  tierBadgeText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  photoIndicators: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  photoIndicator: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  photoIndicatorActive: { backgroundColor: '#fff', width: 24 },
  userInfo: { padding: 20 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  displayName: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  verificationRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 12 },
  verificationBar: { flex: 1, height: 6, backgroundColor: '#1a1a24', borderRadius: 3, overflow: 'hidden' },
  verificationProgress: { height: '100%', backgroundColor: '#00d4ff', borderRadius: 3 },
  verificationText: { color: '#888', fontSize: 12 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 12, gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  badgeText: { fontSize: 12, fontWeight: '600' },
  verifyNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#00d4ff20',
    borderRadius: 16,
  },
  verifyNowText: { color: '#00d4ff', fontWeight: '600' },
  bio: { marginTop: 16, fontSize: 16, color: '#ccc', lineHeight: 24 },
  visibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1a1a24',
    borderRadius: 16,
  },
  visibilityText: { color: '#00d4ff', fontSize: 12, fontWeight: '600' },
  actionsRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 12 },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1a1a24',
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonText: { color: '#fff', fontWeight: '600' },
  sectionPadded: { paddingHorizontal: 20, marginTop: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardSubtitle: { color: '#888', fontSize: 14, marginTop: 4 },
  primaryBtn: { backgroundColor: '#00d4ff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  primaryBtnText: { color: '#000', fontWeight: '700', fontSize: 14 },
  card: {
    backgroundColor: '#12121f',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f33',
    gap: 8,
  },
  cardSpaced: { marginTop: 12, gap: 10 },
  cardHeader: { color: '#fff', fontSize: 14, fontWeight: '700', marginBottom: 2 },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  xpText: { color: '#00d4ff', fontSize: 14, fontWeight: '600' },
  barTrack: { height: 8, backgroundColor: '#1f1f33', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#00d4ff', borderRadius: 4 },
  subText: { color: '#888', fontSize: 12 },
  streakText: { color: '#ff9d3c', fontSize: 12, fontWeight: '600' },
  challengeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { color: '#555', fontSize: 18 },
  checkboxDone: { color: '#00d4ff' },
  challengeTitle: { color: '#ddd', fontSize: 14, flex: 1 },
  challengeTitleDone: { color: '#666', textDecorationLine: 'line-through' },
  challengeReward: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },
  gamificationRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 16, gap: 10 },
  giftsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 10,
    padding: 16,
    backgroundColor: '#1a1a24',
    borderRadius: 12,
  },
  giftsCardBody: { flex: 1 },
  giftsCardTitle: { color: '#fff', fontSize: 15, fontWeight: '700' },
  giftsCardSubtitle: { color: '#888', fontSize: 12, marginTop: 2 },
  gamificationCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    paddingVertical: 16,
    borderRadius: 12,
  },
  gamificationTitle: { color: '#fff', fontWeight: '600', fontSize: 12, marginTop: 8 },
  gamificationSubtitle: { color: '#666', fontSize: 10, marginTop: 2 },
  section: { padding: 20, borderTopWidth: 1, borderTopColor: '#1a1a24', marginTop: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#fff', marginBottom: 12 },
  sectionAction: { color: '#00d4ff', fontWeight: '600' },
  infoCard: { backgroundColor: '#1a1a24', borderRadius: 12, overflow: 'hidden' },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a34',
  },
  infoRowLast: { borderBottomWidth: 0 },
  infoText: { flex: 1, color: '#fff', fontSize: 15 },
  infoTextMuted: { color: '#666' },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridPhotoActive: { borderColor: '#00d4ff' },
  gridPhotoImage: { width: '100%', height: '100%' },
  addPhotoButton: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    backgroundColor: '#1a1a24',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#2a2a34',
    borderStyle: 'dashed',
  },
  tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { backgroundColor: '#1a1a24', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  tagText: { color: '#fff', fontSize: 14 },
  goalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a24',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  goalIcon: { fontSize: 18 },
  goalText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  socialLinkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a34',
  },
  socialIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  socialLinkInfo: { flex: 1, marginLeft: 12 },
  socialLinkName: { color: '#fff', fontWeight: '600' },
  socialLinkUsername: { color: '#888', fontSize: 12 },
  connectSocialButton: { alignItems: 'center', padding: 24, gap: 8 },
  connectSocialText: { color: '#00d4ff', fontWeight: '600', fontSize: 16 },
  connectSocialSubtext: { color: '#666', fontSize: 12 },
  upgradeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    padding: 16,
    backgroundColor: '#1a1a24',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFD70040',
  },
  upgradeContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  upgradeText: { flex: 1 },
  upgradeTitle: { color: '#FFD700', fontWeight: '700', fontSize: 16 },
  upgradeSubtitle: { color: '#888', fontSize: 12, marginTop: 2 },
  menuSection: { margin: 20, backgroundColor: '#1a1a24', borderRadius: 12, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a34',
  },
  menuItemText: { flex: 1, marginLeft: 12, color: '#fff', fontSize: 16 },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    padding: 16,
    backgroundColor: '#ff444420',
    borderRadius: 12,
  },
  logoutText: { color: '#ff4444', fontWeight: '600', fontSize: 16 },
  version: { textAlign: 'center', color: '#444', marginVertical: 24 },
});
