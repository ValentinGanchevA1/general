import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile, updateProfile } from '@/features/profile/profileSlice';
import { logout } from '@/features/auth/authSlice';
import { useGamification } from '@/features/gamification/useGamification';
import { useChallenges } from '@/features/gamification/useChallenges';
import { useGiftBalance } from '@/features/gifts/useGifts';
import { TIER_LABEL } from '@/features/profile/socialConfig';
import { buildTrustChips } from '@/components/Profile/buildTrustChips';

/** Data + derived view-model for ProfileScreen composition. */
export function useProfileScreenData() {
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

  const trustChips = useMemo(() => buildTrustChips(profile), [profile]);

  const mapVisible = profile ? profile.visibility !== 'private' : true;

  const handleMapToggle = useCallback(
    (value: boolean) => {
      void dispatch(updateProfile({ visibility: value ? 'public' : 'private' }));
    },
    [dispatch],
  );

  const derived = useMemo(() => {
    if (!profile) return null;
    const photoUrls = profile.photoUrls ?? [];
    const photos = photoUrls.length > 0 ? photoUrls : profile.avatarUrl ? [profile.avatarUrl] : [];
    const tier = profile.subscriptionTier ?? 'free';
    return {
      p: profile,
      photos,
      mainPhoto: photos[activePhotoIndex] ?? profile.avatarUrl,
      coverUrl: profile.coverUrl ?? null,
      interests: profile.interests ?? [],
      goals: profile.goals ?? [],
      socialLinks: profile.socialLinks ?? [],
      badges: profile.badges ?? {
        email: false,
        phone: false,
        photo: false,
        id: false,
        social: false,
        premium: false,
        verified: false,
      },
      tier,
      tierLabel: TIER_LABEL[tier],
      verificationScore: profile.verificationScore ?? 0,
      isPaid: tier !== 'free',
      showIdCta: profile.idVerificationStatus !== 'verified',
      displayName: profile.displayName + (profile.age ? `, ${profile.age}` : ''),
    };
  }, [profile, activePhotoIndex]);

  return {
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
    reload,
    handleLogout,
    handleMapToggle,
    dispatch,
  };
}
