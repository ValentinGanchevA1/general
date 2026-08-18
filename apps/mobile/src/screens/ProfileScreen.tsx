import React, { useEffect } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { fetchProfile } from '@/features/profile/profileSlice';
import {
  fetchPendingCount,
  pendingCountSet,
} from '@/features/friends/friendsSlice';
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
import { useAppSelector } from '@/hooks/redux';
import { useSocket } from '@/realtime/useSocket';
import { colors, spacing } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Self profile — pure composition over Profile/* sections. */
export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const { on } = useSocket();
  const pendingCount = useAppSelector((s) => s.friends.pendingCount);
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

  useEffect(() => {
    void dispatch(fetchPendingCount());
  }, [dispatch]);

  useEffect(() => {
    const unsubReq = on('friend:request', (e) => {
      dispatch(pendingCountSet(e.pendingCount));
    });
    const unsubAcc = on('friend:accepted', () => {
      // no badge change for acceptor; requester gets toast later
    });
    return () => {
      unsubReq();
      unsubAcc();
    };
  }, [on, dispatch]);

  if (loading && !derived) {
    return <ProfileLoadingState />;
  }
  if (!derived) {
    return (
      <ProfileErrorState
        message={error ?? 'Could not load profile'}
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
  } = derived;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <ProfileHeaderPhoto
          photos={photos}
          mainPhoto={mainPhoto}
          activeIndex={activePhotoIndex}
          onIndexChange={setActivePhotoIndex}
          displayName={displayName}
          verification={p.verification}
          idVerified={p.idVerified}
          online={p.online}
          age={p.age}
          hometownCity={p.hometownCity}
          hometownCountry={p.hometownCountry}
          showAge={p.showAge}
          showHometown={p.showHometown}
        />

        <MapPresenceCard visible={mapVisible} onToggle={handleMapToggle} saving={saving} />

        <TrustStrip
          verificationScore={verificationScore}
          badges={badges}
          isPaid={isPaid}
          trustChips={trustChips}
        />

        <ProfileBio bio={p.bio} />

        {showIdCta ? (
          <ProfileIdCta onPress={() => navigation.navigate('Verification')} />
        ) : null}

        <ProfileQuickActions
          onEdit={() => navigation.navigate('ProfileEdit')}
          onViewPin={() => openRootScreen(navigation, 'Map', { focusMyPin: true })}
          onSettings={() => navigation.navigate('Settings')}
        />

        <ProfileFriendsCard
          pendingCount={pendingCount}
          onFriends={() => navigation.navigate('FriendsList')}
          onRequests={() => navigation.navigate('FriendsList', { initialTab: 'requests' })}
        />

        <ProfileActivityLinks
          spendableXp={spendableXp}
          challenges={challenges}
          gamification={gamification}
          onGifts={() => navigation.navigate('MyGifts')}
          onAchievements={() => navigation.navigate('Achievements')}
        />

        <ProfilePhotosSection photos={photos} isSelf />

        <View style={styles.section}>
          <ProfileStoryline userId={p.id} />
        </View>

        <ProfileTagsSection interests={interests} goals={goals} />

        <ProfileAccountSection
          email={p.email}
          phone={p.phone}
          onEdit={() => navigation.navigate('ProfileEdit')}
        />

        <ProfileSocialSection links={socialLinks} />

        <ProfileMenuSection
          onSettings={() => navigation.navigate('Settings')}
          onLogout={handleLogout}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: spacing.xxl },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.md },
});
