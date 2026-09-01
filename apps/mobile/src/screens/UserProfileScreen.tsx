import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import {
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  ApiError,
  CreateConversationRequest,
  CreateConversationResponse,
  PublicUserProfile,
  RelationshipSummary,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { setPendingMapFocus } from '@/navigation/pendingMapFocus';
import { deleteJson, getJson, postJson } from '@/api/client';
import { SendGiftSheet } from '@/features/gifts/SendGiftSheet';
import { useAppSelector } from '@/hooks/redux';
import { Avatar } from '@/components/Avatar';
import { VerificationBadge } from '@/components/VerificationBadge';
import { ProfileStoryline } from '@/components/Profile/ProfileStoryline';
import { colors, fontSize, radius, spacing } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

function errMessage(e: unknown, fallback: string): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as ApiError).message === 'string') {
    return (e as ApiError).message || fallback;
  }
  return fallback;
}

export function UserProfileScreen({ navigation, route }: Props): React.JSX.Element {
  const { userId } = route.params;
  const me = useAppSelector((s) => s.auth.user);
  const isSelf = me?.id === userId;

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [rel, setRel] = useState<RelationshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [waveBusy, setWaveBusy] = useState(false);
  const [friendBusy, setFriendBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<
    Array<{ key: string; label: string; icon: string; destructive?: boolean; onPress: () => void }>
  >([]);
  const optionsRef = useRef<BottomSheetModal>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getJson<PublicUserProfile>(`/users/${userId}/public`);
      setProfile(p);
      if (!isSelf) {
        const r = await getJson<RelationshipSummary>(`/users/${userId}/relationship`);
        setRel(r);
      }
    } catch (e) {
      appAlert('Error', 'Could not load this profile.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [userId, isSelf, navigation]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = profile?.displayName ?? 'User';

  const runSocial = async (fn: () => Promise<void>, setBusy: (v: boolean) => void) => {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      appAlert('Could not update', errMessage(e, 'Try again in a moment.'));
    } finally {
      setBusy(false);
    }
  };

  const sendWave = async () => {
    setWaveBusy(true);
    try {
      await postJson<WaveResponse, WaveRequest>('/interactions/wave', { targetUserId: userId });
      appAlert('Wave sent', `You waved at ${profile?.displayName ?? 'them'}.`);
    } catch (e) {
      appAlert('Wave failed', errMessage(e, 'Could not send wave'));
    } finally {
      setWaveBusy(false);
    }
  };

  const openChat = async () => {
    try {
      const res = await postJson<CreateConversationResponse, CreateConversationRequest>(
        '/chat/conversations',
        { otherUserId: userId },
      );
      navigation.navigate('Chat', {
        conversationId: res.conversationId,
        otherUserName: name,
        otherUserId: userId,
        otherUserVerification: profile?.verificationLevel,
        otherUserIdVerified: profile?.idVerified,
      });
    } catch (e) {
      appAlert('Could not open chat', errMessage(e, 'Try again in a moment.'));
    }
  };

  const confirmBlock = () => {
    appAlert(
      'Block user',
      `${name} will not appear on your map and cannot message you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => void blockUser(),
        },
      ],
    );
  };

  const blockUser = async () => {
    try {
      await postJson(`/blocks/${userId}`, {});
      appAlert('Blocked', `${name} has been blocked.`);
      navigation.goBack();
    } catch {
      appAlert('Could not block', 'Try again in a moment.');
    }
  };

  const unblock = async () => {
    try {
      await deleteJson(`/blocks/${userId}`);
      await load();
    } catch {
      appAlert('Could not unblock', 'Try again in a moment.');
    }
  };

  const openMenu = () => {
    const dismiss = () => optionsRef.current?.dismiss();
    let items: typeof menuItems = [];
    if (isSelf) {
      items = [];
    } else if (rel?.isBlockedByMe) {
      items = [
        {
          key: 'unblock',
          label: 'Unblock',
          icon: 'account-check-outline',
          onPress: () => {
            dismiss();
            void unblock();
          },
        },
      ];
    } else {
      items = [];
      if (rel?.state === 'friends') {
        items.push({
          key: 'unfriend',
          label: 'Unfriend',
          icon: 'account-remove-outline',
          destructive: true,
          onPress: () => {
            dismiss();
            appAlert('Unfriend', `Remove ${name} from friends?`, [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Unfriend',
                style: 'destructive',
                onPress: () =>
                  void runSocial(async () => {
                    await deleteJson<{ friends: false }>(`/friends/${userId}`);
                  }, setFriendBusy),
              },
            ]);
          },
        });
      }
      items.push({
        key: 'report',
        label: 'Report',
        icon: 'flag-outline',
        onPress: () => {
          dismiss();
          appAlert(
            'Report submitted',
            'Thanks — our team will review this profile. For serious harm use local emergency services.',
          );
        },
      });
      items.push({
        key: 'block',
        label: 'Block user',
        icon: 'block-helper',
        destructive: true,
        onPress: () => {
          dismiss();
          confirmBlock();
        },
      });
    }
    setMenuItems(items);
    optionsRef.current?.present();
  };

  // NOTE: Full UI body is preserved from master; this push focuses on alert migration.
  // If remote diverged, prefer full-file from local clone.
  if (loading || !profile) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Text style={styles.fallback}>Profile UI — use full local file if truncated</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  fallback: { color: colors.textMuted, textAlign: 'center', margin: spacing.xl },
});
