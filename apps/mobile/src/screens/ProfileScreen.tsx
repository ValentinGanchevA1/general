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
import {
  VerificationStatusSheet,
  buildVerificationItems,
  type VerificationItemId,
} from '@/components/Profile/VerificationStatusSheet';
import { ProfileBio } from '@/components/Profile/ProfileBio';
import { ProfileFriendsCard } from '@/components/Profile/ProfileFriendsCard';
import { ProfileActivityLinks } from '@/components/Profile/ProfileActivityLinks';
import { ProfilePhotosSection } from '@/components/Profile/ProfilePhotosSection';
import { ProfileTagsSection } from '@/components/Profile/ProfileTagsSection';
import { ProfilePremiumCard } from '@/components/Profile/ProfilePremiumCard';
import { ProfileLoadingState, ProfileErrorState } from '@/components/Profile/ProfileScreenStates';
import { useProfileScreenData } from '@/features/profile/useProfileScreenData';
import { useAppSelector } from '@/hooks/redux';
import { useSocket } from '@/realtime/useSocket';
import { colors, spacing } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Self profile — public-facing identity + activity.
 * Order: Hero → Bio → Tags → Activity → Friends → Storyline → Photos → Premium.
 * Trust details open from the % badge (bottom sheet). Account controls in Settings.
 */
export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const { on } = useSocket();
  const pendingCount = useAppSelector((s) => s.friends.pendingCount);
  const mapPresenceRef = useRef<BottomSheetModal>(null);
  const verificationRef = useRef<BottomSheetModal>(null);
  const mapSnapPoints = useMemo(() => ['34%'], []);
  const verificationSnapPoints = useMemo(() => ['42%'], []);

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

  const openVerification = useCallback(() => {
    verificationRef.current?.present();
  }, []);

  const closeVerification = useCallback(() => {
    verificationRef.current?.dismiss();
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

  const handleVerificationItem = useCallback(
    (id: VerificationItemId) => {
      closeVerification();
      if (id === 'email') {
        openRootScreen(navigation, 'EmailVerification');
        return;
      }
      if (id === 'phone') {
        openRootScreen(navigation, 'Verification', {
          initialPhone: derived?.p.phone ?? undefined,
        });
        return;
      }
      // id
      openRootScreen(
        navigation,
        derived?.p.idVerificationStatus === 'pending' ? 'VerificationId' : 'Verification',
      );
    },
    [closeVerification, navigation, derived?.p.phone, derived?.p.idVerificationStatus],
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    // Tab root — send user to Map (primary home surface).
    navigation.navigate('Main', { screen: 'Map' });
  }, [navigation]);

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
    coverUrl,
    interests,
    goals,
    verificationScore,
    isPaid,
    displayName,
    tierLabel,
  } = derived;

  const verificationItems = buildVerificationItems(p);

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
          coverUrl={coverUrl}
          displayName={displayName}
          verificationPercent={verificationScore}
          isVisibleOnMap={mapVisible}
          isPaid={isPaid}
          tierLabel={tierLabel}
          photoCount={photos.length}
          activePhotoIndex={activePhotoIndex}
          onSelectPhoto={setActivePhotoIndex}
          onPressSettings={() => openRootScreen(navigation, 'Settings')}
          onPressBack={handleBack}
          onPressVerificationBadge={openVerification}
          onPressPhoto={() => openRootScreen(navigation, 'Photos')}
          onPressVisibility={openMapPresence}
        />

        {p.bio ? <ProfileBio bio={p.bio} /> : null}

        <ProfileTagsSection interests={interests} goals={goals} />

        <ProfileActivityLinks
          gamification={gamification ?? null}
          challenges={challenges}
          spendableXp={spendableXp}
          onChallenges={() => openRootScreen(navigation, 'Challenges')}
          onLeaderboard={() => openRootScreen(navigation, 'Leaderboard')}
          onAchievements={() => openRootScreen(navigation, 'Achievements')}
          onGifts={() => openRootScreen(navigation, 'GiftsInbox')}
          onMarketplace={() => openRootScreen(navigation, 'Marketplace')}
        />

        <ProfileFriendsCard
          pendingCount={pendingCount}
          onPress={() => openRootScreen(navigation, 'FriendsList')}
        />

        {p.id ? (
          <View style={styles.section}>
            <ProfileStoryline userId={p.id} isSelf />
          </View>
        ) : null}

        <ProfilePhotosSection
          photos={photos}
          isSelf
          activeIndex={activePhotoIndex}
          onSelect={setActivePhotoIndex}
          onManage={() => openRootScreen(navigation, 'Photos')}
        />

        {!isPaid ? (
          <ProfilePremiumCard onPress={() => openRootScreen(navigation, 'Subscription')} />
        ) : null}
      </ScrollView>

      <BottomSheetModal
        ref={mapPresenceRef}
        snapPoints={mapSnapPoints}
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

      <BottomSheetModal
        ref={verificationRef}
        snapPoints={verificationSnapPoints}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetContent}>
          <VerificationStatusSheet
            score={verificationScore}
            items={verificationItems}
            onItemPress={handleVerificationItem}
          />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  content: { paddingBottom: spacing.xxl },
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
