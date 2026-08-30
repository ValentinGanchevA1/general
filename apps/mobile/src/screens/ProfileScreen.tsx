import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
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
import { ProfileContactLine } from '@/components/Profile/ProfileContactLine';
import { ProfilePremiumCard } from '@/components/Profile/ProfilePremiumCard';
import { ProfileLoadingState, ProfileErrorState } from '@/components/Profile/ProfileScreenStates';
import { useProfileScreenData } from '@/features/profile/useProfileScreenData';
import { useAppSelector } from '@/hooks/redux';
import { useSocket } from '@/realtime/useSocket';
import { colors, spacing } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Self profile — public-facing identity + activity.
 * Account controls (settings, social, legal, logout) live in Settings.
 */
export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const { on } = useSocket();
  const pendingCount = useAppSelector((s) => s.friends.pendingCount);
  const mapPresenceRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['34%'], []);

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
      // no badge change for acceptor
    });
    return () => {
      unsubReq();
      unsubAcc();
    };
  }, [on, dispatch]);

  const openMapPresence = useCallback(() => {
    mapPresenceRef.current?.present();
  }, []);

  const closeMapPresence = useCallback(() => {
    mapPresenceRef.current?.dismiss();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.55}
        pressBehavior="close"
      />
    ),
    [],
  );

  if (loading && !derived) {
    return <ProfileLoadingState />;
  }
  if (!derived) {
    return (
      <ProfileErrorState
        message={error ?? 'Could not load profile'}
        onRetry={() => void dispatch(fetchProfile())}
      />
    );
  }

  const {
    p,
    photos,
    mainPhoto,
    interests,
    goals,
    badges,
    verificationScore,
    isPaid,
    showIdCta,
    displayName,
    tierLabel,
  } = derived;

  return (
    <>
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
          onPressVisibility={openMapPresence}
        />

        <ProfileContactLine
          email={p.email}
          phone={p.phone}
          emailVerified={!!badges.email}
          phoneVerified={!!badges.phone}
        />

        <View style={styles.trustSection}>
          <TrustStrip
            chips={trustChips}
            onChipPress={(id) => {
              if (id === 'email') {
                openRootScreen(navigation, 'EmailVerification');
                return;
              }
              if (id === 'phone') {
                openRootScreen(navigation, 'Verification', {
                  initialPhone: p.phone ?? undefined,
                });
                return;
              }
              if (id === 'id' || id === 'percent') {
                openRootScreen(
                  navigation,
                  p.idVerificationStatus === 'pending' ? 'VerificationId' : 'Verification',
                );
              }
            }}
          />
        </View>

        {showIdCta ? (
          <ProfileIdCta
            status={p.idVerificationStatus}
            onPress={() => openRootScreen(navigation, 'VerificationId')}
          />
        ) : null}

        {p.bio ? <ProfileBio bio={p.bio} /> : null}

        <ProfileQuickActions onEdit={() => openRootScreen(navigation, 'ProfileEdit')} />

        <ProfileFriendsCard
          pendingCount={pendingCount}
          onPress={() => openRootScreen(navigation, 'FriendsList')}
        />

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

        {!isPaid ? (
          <ProfilePremiumCard onPress={() => openRootScreen(navigation, 'Subscription')} />
        ) : null}
      </ScrollView>

      <BottomSheetModal
        ref={mapPresenceRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetContent}>
          <MapPresenceCard
            isVisible={mapVisible}
            saving={saving}
            onToggle={handleMapToggle}
            onViewPin={() => {
              closeMapPresence();
              navigation.navigate('Main', { screen: 'Map', params: { focusMyPin: true } });
            }}
          />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
  trustSection: { marginTop: spacing.md },
  section: { marginTop: spacing.lg, paddingHorizontal: spacing.xl },
  sheetBackground: {
    backgroundColor: colors.surfaceRaised,
  },
  sheetHandle: {
    backgroundColor: colors.textMuted,
    width: 40,
  },
  sheetContent: {
    paddingBottom: spacing.xl,
  },
});
