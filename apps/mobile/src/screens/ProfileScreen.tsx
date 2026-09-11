import React, { useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import BottomSheet, { BottomSheetModal, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import type { BottomSheetBackdropProps } from '@gorhom/bottom-sheet';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { openRootScreen } from '@/navigation/openRootScreen';
import { colors, fontSize, spacing, radius } from '@/theme';
import { ProfileHeaderPhoto } from '@/components/Profile/ProfileHeaderPhoto';
import { ProfileContactLine } from '@/components/Profile/ProfileContactLine';
import { ProfileStoryline } from '@/components/Profile/ProfileStoryline';
import { TrustNextCard } from '@/components/Profile/TrustNextCard';
import {
  VerificationStatusSheet,
  buildVerificationItems,
  type VerificationItemId,
} from '@/components/Profile/VerificationStatusSheet';
import { ProfileMenuSection } from '@/components/Profile/ProfileMenuSection';
import { IdentityBlock } from '@/components/IdentityBlock';

export function ProfileScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.data);
  const loading = useAppSelector((s) => s.profile.loading);

  const verificationRef = useRef<BottomSheetModal>(null);
  const verificationSnapPoints = useMemo(() => ['42%'], []);

  const derived = useMemo(() => {
    if (!profile) return null;
    const p = profile;
    const verificationScore = p.verificationScore ?? 0;
    return { p, verificationScore };
  }, [profile]);

  const onRefresh = useCallback(() => {
    void dispatch(fetchProfile());
  }, [dispatch]);

  const openVerification = useCallback(() => {
    verificationRef.current?.present();
  }, []);

  const closeVerification = useCallback(() => {
    verificationRef.current?.dismiss();
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
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
      // id — always the ID flow (pending/rejected/not-started handled inside VerificationIdScreen)
      openRootScreen(navigation, 'VerificationId');
    },
    [closeVerification, navigation, derived?.p.phone],
  );

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
  }, [navigation]);

  if (!derived) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.muted}>Loading profile…</Text>
      </View>
    );
  }

  const { p, verificationScore } = derived;
  const verificationItems = buildVerificationItems(p);

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={!!loading} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <ProfileHeaderPhoto
          profile={p}
          verificationPercent={verificationScore}
          onPressBack={handleBack}
          onPressSettings={() => openRootScreen(navigation, 'Settings')}
          onPressEdit={() => openRootScreen(navigation, 'ProfileEdit')}
          onPressVerificationBadge={openVerification}
        />

        <View style={styles.body}>
          <IdentityBlock profile={p} />
          <ProfileContactLine profile={p} />
          <TrustNextCard
            profile={p}
            onContinue={handleVerificationItem}
            onOpenDetails={openVerification}
          />
          <ProfileStoryline userId={p.id} isOwner />
          <ProfileMenuSection />
        </View>
      </ScrollView>

      <BottomSheetModal
        ref={verificationRef}
        snapPoints={verificationSnapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBg}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <VerificationStatusSheet
          score={verificationScore}
          items={verificationItems}
          onItemPress={handleVerificationItem}
        />
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  muted: { color: colors.textMuted },
  scroll: { paddingBottom: spacing.xxl },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md, marginTop: spacing.md },
  sheetBg: { backgroundColor: colors.surface },
  sheetHandle: { backgroundColor: colors.borderStrong },
});
