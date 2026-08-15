import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { TIER_LABEL } from '@/features/profile/socialConfig';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';
import { ProfileHeaderPhoto } from '@/components/Profile/ProfileHeaderPhoto';
import { MapPresenceCard } from '@/components/Profile/MapPresenceCard';
import { TrustStrip, type TrustChip } from '@/components/Profile/TrustStrip';
import { ProfileBio } from '@/components/Profile/ProfileBio';
import { ProfileIdCta } from '@/components/Profile/ProfileIdCta';
import { ProfileQuickActions } from '@/components/Profile/ProfileQuickActions';
import { ProfileActivityLinks } from '@/components/Profile/ProfileActivityLinks';
import { ProfilePhotosSection } from '@/components/Profile/ProfilePhotosSection';
import { ProfileTagsSection } from '@/components/Profile/ProfileTagsSection';
import { ProfileAccountSection } from '@/components/Profile/ProfileAccountSection';
import { ProfileSocialSection } from '@/components/Profile/ProfileSocialSection';
import { ProfileMenuSection } from '@/components/Profile/ProfileMenuSection';
import { colors, spacing } from '@/theme';
import type { UserProfile } from '@g88/shared';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const dispatch = useAppDispatch();
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
    refreshGiftBalance();
    setRefreshing(false);
  }, [dispatch, refreshGamification, refreshChallenges, refreshGiftBalance]);

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
    email: false,
    phone: false,
    photo: false,
    id: false,
    social: false,
    premium: false,
    verified: false,
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
          onViewPin={() =>
            navigation.navigate('Main', { screen: 'Map', params: { focusMyPin: true } })
          }
        />
      </View>

      {showIdCta ? (
        <ProfileIdCta
          status={p.idVerificationStatus}
          onPress={() => navigation.navigate('VerificationId')}
        />
      ) : null}

      {p.bio ? <ProfileBio bio={p.bio} /> : null}

      <ProfileQuickActions
        onEdit={() => navigation.navigate('ProfileEdit')}
        onPhotos={() => navigation.navigate('Photos')}
        onTrust={() => navigation.navigate('Verification')}
      />

      <ProfileActivityLinks
        gamification={gamification ?? null}
        challenges={challenges}
        spendableXp={spendableXp}
        onChallenges={() => navigation.navigate('Challenges')}
        onLeaderboard={() => navigation.navigate('Leaderboard')}
        onAchievements={() => navigation.navigate('Achievements')}
        onGifts={() => navigation.navigate('GiftsInbox')}
      />

      <ProfilePhotosSection
        photos={photos}
        isSelf
        activeIndex={activePhotoIndex}
        onSelect={setActivePhotoIndex}
        onManage={() => navigation.navigate('Photos')}
      />

      {p.id ? (
        <View style={styles.section}>
          <ProfileStoryline userId={p.id} isSelf />
        </View>
      ) : null}

      <ProfileTagsSection interests={interests} goals={goals} />

      <ProfileAccountSection
        email={p.email}
        phone={p.phone}
        emailVerified={!!badges.email}
        phoneVerified={!!badges.phone}
        onAddPhone={() => navigation.navigate('Verification')}
      />

      <ProfileSocialSection
        links={socialLinks}
        onManage={() => navigation.navigate('SocialLinking')}
      />

      <ProfileMenuSection
        isPaid={isPaid}
        onNavigate={(route) => navigation.navigate(route)}
        onLogout={handleLogout}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  centerFill: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  errorTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700', marginTop: 8 },
  errorMsg: { color: colors.textMuted, textAlign: 'center', marginBottom: 8 },
  retryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: { color: colors.onPrimary, fontWeight: '700' },
  errorLogout: { color: colors.danger, fontWeight: '600' },
  // TrustStrip + MapPresenceCard already self-pad horizontally
  trustSection: { marginTop: spacing.md },
  mapPresenceSection: { marginTop: spacing.sm },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.xl },
});
