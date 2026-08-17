import React from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { fetchProfile } from '@/features/profile/profileSlice';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';
import { ProfileHeaderPhoto } from '@/components/Profile/ProfileHeaderPhoto';
import { MapPresenceCard } from '@/components/Profile/MapPresenceCard';
import { TrustStrip } from '@/components/Profile/TrustStrip';
import { ProfileBio } from '@/components/Profile/ProfileBio';
import { ProfileIdCta } from '@/components/Profile/ProfileIdCta';
import { ProfileQuickActions } from '@/components/Profile/ProfileQuickActions';
import { ProfileFriendsCard } from '@/components/Profile/ProfileFriendsCard';
import { ProfileActivityLinks } from '@/components/Profile/ProfileActivityLinks';
import { ProfilePhotosSection } from '@/components/Profile/ProfilePhotosSection';
import { ProfileTagsSection } from '@/components/Profile/ProfileTagsSection';
import { ProfileAccountSection } from '@/components/Profile/ProfileAccountSection';
import { ProfileSocialSection } from '@/components/Profile/ProfileSocialSection';
import { ProfileMenuSection } from '@/components/Profile/ProfileMenuSection';
import { ProfileLoadingState, ProfileErrorState } from '@/components/Profile/ProfileScreenStates';
import { useProfileScreenData } from '@/features/profile/useProfileScreenData';
import { colors, spacing } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Self profile — pure composition over Profile/* sections. */
export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const {
    loading,
    error,
    saving,
    refreshing,
    activePhotoIndex,
    setActivePhotoIndex,
    gamification,
    challenges,
    spendableXp,
    trustChips,
    mapVisible,
    derived,
    onRefresh,
    handleLogout,
    handleMapToggle,
    dispatch,
  } = useProfileScreenData();

  if (loading && !derived) {
    return <ProfileLoadingState />;
  }
  if (!derived) {
    return (
      <ProfileErrorState
        message={error}
        onRetry={() => void dispatch(fetchProfile())}
        onLogout={handleLogout}
      />
    );
  }

  const {
    p,
    photos,
    mainPhoto,
    interests,
    goals,
    socialLinks,
    badges,
    verificationScore,
    isPaid,
    showIdCta,
    displayName,
    tierLabel,
  } = derived;

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
        displayName={displayName}
        verificationPercent={verificationScore}
        isVisibleOnMap={mapVisible}
        isPaid={isPaid}
        tierLabel={tierLabel}
        photoCount={photos.length}
        activePhotoIndex={activePhotoIndex}
        onSelectPhoto={setActivePhotoIndex}
        onPressSettings={() => openRootScreen(navigation, 'Settings')}
        onPressVerificationBadge={() => openRootScreen(navigation, 'Verification')}
        onPressPhoto={() => openRootScreen(navigation, 'Photos')}
      />

      <View style={styles.trustSection}>
        <TrustStrip
          chips={trustChips}
          onChipPress={(id) => {
            if (id === 'id' || id === 'percent') {
              openRootScreen(
                navigation,
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
          onPress={() => openRootScreen(navigation, 'VerificationId')}
        />
      ) : null}

      {p.bio ? <ProfileBio bio={p.bio} /> : null}

      <ProfileQuickActions
        onEdit={() => openRootScreen(navigation, 'ProfileEdit')}
        onPhotos={() => openRootScreen(navigation, 'Photos')}
        onTrust={() => openRootScreen(navigation, 'Verification')}
      />

      <ProfileFriendsCard onPress={() => openRootScreen(navigation, 'FriendsList')} />

      <ProfileActivityLinks
        gamification={gamification ?? null}
        challenges={challenges}
        spendableXp={spendableXp}
        onChallenges={() => openRootScreen(navigation, 'Challenges')}
        onLeaderboard={() => openRootScreen(navigation, 'Leaderboard')}
        onAchievements={() => openRootScreen(navigation, 'Achievements')}
        onGifts={() => openRootScreen(navigation, 'GiftsInbox')}
      />

      <ProfilePhotosSection
        photos={photos}
        isSelf
        activeIndex={activePhotoIndex}
        onSelect={setActivePhotoIndex}
        onManage={() => openRootScreen(navigation, 'Photos')}
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
        onAddPhone={() => openRootScreen(navigation, 'Verification')}
      />

      <ProfileSocialSection
        links={socialLinks}
        onManage={() => openRootScreen(navigation, 'SocialLinking')}
      />

      <ProfileMenuSection
        isPaid={isPaid}
        onNavigate={(route) => openRootScreen(navigation, route)}
        onLogout={handleLogout}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  trustSection: { marginTop: spacing.md },
  mapPresenceSection: { marginTop: spacing.sm },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.xl },
});
