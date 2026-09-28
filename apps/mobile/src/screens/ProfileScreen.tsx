import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { RefreshControl, StyleSheet } from 'react-native';
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
import { ProfileView } from '@/components/Profile/ProfileView';
import { MapPresenceCard } from '@/components/Profile/MapPresenceCard';
import {
  VerificationStatusSheet,
  buildVerificationItems,
  type VerificationItemId,
} from '@/components/Profile/VerificationStatusSheet';
import { TrustNextCard } from '@/components/Profile/TrustNextCard';
import { ProfileFriendsCard } from '@/components/Profile/ProfileFriendsCard';
import { ProfileActivityLinks } from '@/components/Profile/ProfileActivityLinks';
import { ProfilePremiumCard } from '@/components/Profile/ProfilePremiumCard';
import { ProfileLoadingState, ProfileErrorState } from '@/components/Profile/ProfileScreenStates';
import { useProfileScreenData } from '@/features/profile/useProfileScreenData';
import { mapSelfToViewModel } from '@/features/profile/mapToProfileViewModel';
import { useAppSelector } from '@/hooks/redux';
import { useSocket } from '@/realtime/useSocket';
import { colors, spacing } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/**
 * Self profile — data + sheets.
 * Layout lives in ProfileView mode="self" (PR-D).
 * Order: Hero → identity → Bio → Tags → Trust → Activity → Friends → Storyline → Photos → Premium.
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
      openRootScreen(navigation, 'VerificationId');
    },
    [closeVerification, navigation, derived?.p.phone],
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
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
    verificationScore: _score,
    isPaid,
    tierLabel,
  } = derived;

  const verificationItems = buildVerificationItems(p);

  const viewModel = mapSelfToViewModel(p, {
    photoUrls: photos,
    tierLabel,
    isPaid,
    mapVisible,
  });

  return (
    <>
      <ProfileView
        mode="self"
        profile={viewModel}
        activePhotoIndex={activePhotoIndex}
        pendingFriendCount={pendingCount}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        actions={{
          onBack: handleBack,
          onPressSettings: () => openRootScreen(navigation, 'Settings'),
          onPressVerificationBadge: openVerification,
          onPressPhoto: () => openRootScreen(navigation, 'Photos'),
          onSelectPhotoIndex: setActivePhotoIndex,
          onPressIdentityPreview: () => openRootScreen(navigation, 'ProfileEdit'),
          onPressVisibility: openMapPresence,
          onPressPhotosManage: () => openRootScreen(navigation, 'Photos'),
          onPressPremium: () => openRootScreen(navigation, 'Subscription'),
          onPressFriends: () => openRootScreen(navigation, 'FriendsList'),
          onPressSuggestions: () => openRootScreen(navigation, 'Suggestions'),
          onPressChallenges: () => openRootScreen(navigation, 'Challenges'),
          onPressLeaderboard: () => openRootScreen(navigation, 'Leaderboard'),
          onPressAchievements: () => openRootScreen(navigation, 'Achievements'),
          onPressGifts: () => openRootScreen(navigation, 'GiftsInbox'),
          onPressMarketplace: () => openRootScreen(navigation, 'Marketplace'),
          onTrustContinue: handleVerificationItem,
          onOpenTrustDetails: openVerification,
        }}
        selfSlots={{
          trustNext: (
            <TrustNextCard
              profile={p}
              onContinue={handleVerificationItem}
              onOpenDetails={openVerification}
            />
          ),
          activity: (
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
          ),
          friends: (
            <ProfileFriendsCard
              pendingCount={pendingCount}
              onPress={() => openRootScreen(navigation, 'FriendsList')}
              onPressSuggestions={() => openRootScreen(navigation, 'Suggestions')}
            />
          ),
          premium: !isPaid ? (
            <ProfilePremiumCard onPress={() => openRootScreen(navigation, 'Subscription')} />
          ) : null,
        }}
      />

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
            score={p.verificationScore ?? 0}
            items={verificationItems}
            onItemPress={handleVerificationItem}
          />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  );
}

const styles = StyleSheet.create({
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
