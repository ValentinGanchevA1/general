import { useCallback, useEffect, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type {
  ApiError,
  CreateConversationRequest,
  CreateConversationResponse,
  PublicUserProfile,
  RelationshipSummary,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';

import { appAlert } from '@/ui/appAlert';
import { deleteJson, getJson, postJson } from '@/api/client';
import { setPendingMapFocus } from '@/navigation/pendingMapFocus';
import type { RootStackParamList } from '@/navigation/AppNavigator';

function errMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null && 'message' in e) {
    return String((e as ApiError).message);
  }
  return fallback;
}

function emptyRel(): RelationshipSummary {
  return {
    state: 'none',
    mutualFriendsCount: 0,
    isFollowing: false,
    isFollowedBy: false,
  };
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Data + social actions for UserProfileScreen (keeps the screen presentational). */
export function useUserProfileScreenData(userId: string, navigation: Nav) {
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [rel, setRel] = useState<RelationshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [waving, setWaving] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [friendBusy, setFriendBusy] = useState(false);

  const blocked = profile?.blockedByViewer ?? false;
  const canMessage = profile?.relationship?.canMessage ?? 'none';
  const photoUrls = profile?.photoUrls ?? [];
  const coverUri = profile?.coverUrl ?? photoUrls[0] ?? profile?.avatarUrl ?? null;
  const isFollowing = Boolean(rel?.isFollowing);
  const friendLabel =
    rel?.state === 'friends'
      ? 'Friends'
      : rel?.state === 'request_outgoing'
        ? 'Requested'
        : rel?.state === 'request_incoming'
          ? 'Accept'
          : 'Add friend';
  const hometown = [profile?.hometownCity, profile?.hometownCountry]
    .filter(Boolean)
    .join(', ');
  const showMessage = !blocked && (canMessage === 'chat' || canMessage === 'request');

  const loadRelationship = useCallback(async (): Promise<boolean> => {
    try {
      const data = await getJson<RelationshipSummary>(`/friends/relationship/${userId}`);
      setRel(data);
      return true;
    } catch {
      return false;
    }
  }, [userId]);

  const loadProfile = useCallback(() => {
    void (async () => {
      try {
        const data = await getJson<PublicUserProfile>(`/users/${userId}`);
        setProfile(data);
        await loadRelationship();
      } catch {
        appAlert('Error', 'Could not load this profile.', [
          { text: 'Go back', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, navigation, loadRelationship]);

  // Defer reset off the effect body — satisfies react-hooks/set-state-in-effect.
  useEffect(() => {
    const t = queueMicrotask(() => {
      setLoading(true);
      setProfile(null);
      setRel(null);
      loadProfile();
    });
    return () => {
      void t;
    };
  }, [loadProfile]);

  const sendWave = useCallback(async (): Promise<void> => {
    setWaving(true);
    try {
      await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
        toUserId: userId,
        context: 'profile',
      });
      appAlert('Wave sent', `You waved at ${profile?.displayName ?? 'them'}.`);
    } catch (e) {
      appAlert('Wave failed', errMessage(e, 'Could not send wave'));
    } finally {
      setWaving(false);
    }
  }, [userId, profile]);

  const openMessage = useCallback(async (): Promise<void> => {
    if (messaging || canMessage === 'none') return;
    setMessaging(true);
    try {
      const res = await postJson<CreateConversationRequest, CreateConversationResponse>(
        '/conversations',
        { targetUserId: userId },
      );
      navigation.navigate('Chat', {
        conversationId: res.conversationId,
        otherUserName: profile?.displayName ?? 'Chat',
        requestPending: res.status === 'pending' && res.permission === 'request',
        otherUserId: userId,
        ...(profile?.verification != null
          ? { otherUserVerification: profile.verification }
          : {}),
        otherUserIdVerified: profile?.idVerified ?? false,
      });
    } catch (e) {
      appAlert('Could not open chat', errMessage(e, 'Try again in a moment.'));
    } finally {
      setMessaging(false);
    }
  }, [messaging, canMessage, userId, navigation, profile]);

  const viewOnMap = useCallback((): void => {
    const hasCoords =
      profile?.mapLat != null &&
      profile?.mapLng != null &&
      Number.isFinite(profile.mapLat) &&
      Number.isFinite(profile.mapLng);

    if (!hasCoords) {
      appAlert(
        'Location unavailable',
        'This person has no map pin right now. Try again when they are nearby.',
      );
      return;
    }

    const lat = profile!.mapLat!;
    const lng = profile!.mapLng!;

    setPendingMapFocus({
      userId,
      lat,
      lng,
      displayName: profile!.displayName,
      avatarUrl: profile!.avatarUrl,
      verification: profile!.verification,
      online: profile!.online,
    });

    navigation.navigate({
      name: 'Main',
      params: {
        screen: 'Map',
        params: {
          focusUserId: userId,
          focusLat: lat,
          focusLng: lng,
        },
        merge: true,
      },
      merge: true,
    });
  }, [profile, userId, navigation]);

  const block = useCallback(async (): Promise<void> => {
    setBlocking(true);
    try {
      await postJson<undefined, { blocked: boolean }>(`/blocks/${userId}`, undefined);
      appAlert(
        'Blocked',
        `You won't see ${profile?.displayName ?? 'this user'} or hear from them.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
        { cancelable: false },
      );
    } catch {
      appAlert('Could not block', 'Try again in a moment.');
    } finally {
      setBlocking(false);
    }
  }, [userId, profile, navigation]);

  const unblock = useCallback(async (): Promise<void> => {
    setBlocking(true);
    try {
      await deleteJson<{ blocked: boolean }>(`/blocks/${userId}`);
      setProfile((p) => (p ? { ...p, blockedByViewer: false } : p));
      await loadRelationship();
    } catch {
      appAlert('Could not unblock', 'Try again in a moment.');
    } finally {
      setBlocking(false);
    }
  }, [userId, loadRelationship]);

  const confirmBlock = useCallback((): void => {
    appAlert(
      `Block ${profile?.displayName ?? 'this user'}?`,
      "They won't appear on your map and neither of you can message the other. You can undo this in Settings → Blocked users.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void block() },
      ],
    );
  }, [profile, block]);

  const runSocial = useCallback(
    async (fn: () => Promise<void>, setBusy: (v: boolean) => void): Promise<void> => {
      setBusy(true);
      try {
        await fn();
      } catch (e) {
        appAlert('Could not update', errMessage(e, 'Try again in a moment.'));
      } finally {
        await loadRelationship();
        setBusy(false);
      }
    },
    [loadRelationship],
  );

  const onFollowToggle = useCallback((): void => {
    if (followBusy || friendBusy || blocked) return;
    const following = Boolean(rel?.isFollowing);
    if (following) {
      void runSocial(async () => {
        setRel((prev) => {
          const base = prev ?? emptyRel();
          return {
            ...base,
            isFollowing: false,
            state:
              base.state === 'following'
                ? 'none'
                : base.state === 'mutual_follow'
                  ? 'followed_by'
                  : base.state,
          };
        });
        await deleteJson<{ following: false }>(`/friends/follow/${userId}`);
      }, setFollowBusy);
      return;
    }
    void runSocial(async () => {
      setRel((prev) => {
        const base = prev ?? emptyRel();
        return {
          ...base,
          isFollowing: true,
          state:
            base.state === 'none' || base.state === 'followed_by'
              ? base.state === 'followed_by'
                ? 'mutual_follow'
                : 'following'
              : base.state,
        };
      });
      await postJson<{ userId: string }, { following: true }>('/friends/follow', {
        userId,
      });
    }, setFollowBusy);
  }, [followBusy, friendBusy, blocked, rel?.isFollowing, runSocial, userId]);

  const onFriendAction = useCallback((): void => {
    if (friendBusy || followBusy || blocked) return;
    const state = rel?.state ?? 'none';
    switch (state) {
      case 'friends':
        return;
      case 'request_outgoing':
        if (rel?.requestId) {
          void runSocial(async () => {
            await deleteJson<{ cancelled: true }>(`/friends/requests/${rel.requestId}`);
          }, setFriendBusy);
        }
        return;
      case 'request_incoming':
        if (rel?.requestId) {
          void runSocial(async () => {
            await postJson<Record<string, never>, { friends: true }>(
              `/friends/requests/${rel.requestId}/accept`,
              {},
            );
          }, setFriendBusy);
        }
        return;
      default:
        void runSocial(async () => {
          setRel((prev) => ({
            ...(prev ?? emptyRel()),
            state: 'request_outgoing' as const,
            ...(prev?.requestId ? { requestId: prev.requestId } : {}),
          }));
          const res = await postJson<{ userId: string }, { requestId: string }>(
            '/friends/requests',
            { userId },
          );
          setRel((prev) => ({
            ...(prev ?? emptyRel()),
            state: 'request_outgoing' as const,
            requestId: res.requestId,
          }));
        }, setFriendBusy);
    }
  }, [friendBusy, followBusy, blocked, rel, runSocial, userId]);

  const openMutualFriends = useCallback((): void => {
    if (!rel || rel.mutualFriendsCount < 1) return;
    navigation.navigate('MutualFriends', {
      peerUserId: userId,
      ...(profile?.displayName ? { peerName: profile.displayName } : {}),
    });
  }, [rel, navigation, userId, profile]);

  const unfriend = useCallback((): void => {
    void runSocial(async () => {
      await deleteJson<{ friends: false }>(`/friends/${userId}`);
    }, setFriendBusy);
  }, [runSocial, userId]);

  return {
    profile,
    rel,
    loading,
    waving,
    messaging,
    giftSheetOpen,
    setGiftSheetOpen,
    blocking,
    followBusy,
    friendBusy,
    blocked,
    canMessage,
    photoUrls,
    coverUri,
    isFollowing,
    friendLabel,
    hometown,
    showMessage,
    sendWave,
    openMessage,
    viewOnMap,
    block,
    unblock,
    confirmBlock,
    onFollowToggle,
    onFriendAction,
    openMutualFriends,
    unfriend,
    loadRelationship,
  };
}
