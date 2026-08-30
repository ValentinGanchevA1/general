import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  BottomSheetModal,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import type {
  ApiError,
  CreateConversationRequest,
  CreateConversationResponse,
  PublicUserProfile,
  RelationshipSummary,
  VerificationLevel,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { deleteJson, getJson, postJson } from '@/api/client';
import { SendGiftSheet } from '@/features/gifts/SendGiftSheet';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Avatar } from '@/components/Avatar';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';
import { ProfileBio } from '@/components/Profile/ProfileBio';
import { ProfileTagsSection } from '@/components/Profile/ProfileTagsSection';
import { ProfilePhotosSection } from '@/components/Profile/ProfilePhotosSection';
import {
  ActionSheetList,
  sheetChrome,
  useSheetBackdrop,
  type ActionSheetItem,
} from '@/components/sheets';
import { colors, spacing, radius, fontSize } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

const LADDER: VerificationLevel[] = ['none', 'email', 'phone', 'selfie', 'id'];
const LADDER_BADGES: Array<{ level: VerificationLevel; label: string }> = [
  { level: 'email', label: 'Email' },
  { level: 'phone', label: 'Phone' },
  { level: 'selfie', label: 'Photo' },
  { level: 'id', label: 'ID' },
];

function earnedBadges(level: VerificationLevel): string[] {
  const rank = LADDER.indexOf(level);
  return LADDER_BADGES.filter((b) => rank >= LADDER.indexOf(b.level)).map((b) => b.label);
}

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

/** Map-native distance: ~300 m away / ~1.2 km away (fuzzed locations). */
function formatDistanceAway(meters: number): string {
  if (meters < 50) return '~50 m away';
  if (meters < 1000) {
    const rounded = Math.max(100, Math.round(meters / 100) * 100);
    return `~${rounded} m away`;
  }
  const km = meters / 1000;
  if (km < 10) {
    const one = Math.round(km * 10) / 10;
    return `~${one.toFixed(1)} km away`;
  }
  return `~${Math.round(km)} km away`;
}

export function UserProfileScreen({ route, navigation }: Props): React.JSX.Element {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [rel, setRel] = useState<RelationshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [waving, setWaving] = useState(false);
  const [messaging, setMessaging] = useState(false);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [friendBusy, setFriendBusy] = useState(false);
  const [menuItems, setMenuItems] = useState<ActionSheetItem[]>([]);

  const optionsRef = useRef<BottomSheetModal>(null);
  const optionsSnap = useMemo(() => ['28%', '36%'], []);
  const renderBackdrop = useSheetBackdrop(0.55);

  const blocked = profile?.blockedByViewer ?? false;
  const canMessage = profile?.relationship?.canMessage ?? 'none';
  const photoUrls = profile?.photoUrls ?? [];
  const coverUri = photoUrls[0] ?? profile?.avatarUrl ?? null;

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
        Alert.alert('Error', 'Could not load this profile.', [
          { text: 'Go back', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, navigation, loadRelationship]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const sendWave = async (): Promise<void> => {
    setWaving(true);
    try {
      await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
        toUserId: userId,
        context: 'profile',
      });
      Alert.alert('Wave sent', `You waved at ${profile?.displayName ?? 'them'}.`);
    } catch (e) {
      Alert.alert('Wave failed', errMessage(e, 'Could not send wave'));
    } finally {
      setWaving(false);
    }
  };

  const openMessage = async (): Promise<void> => {
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
      Alert.alert('Could not open chat', errMessage(e, 'Try again in a moment.'));
    } finally {
      setMessaging(false);
    }
  };

  /** Jump to Map tab and focus this user's fuzzed pin (coords preferred). */
  const viewOnMap = (): void => {
    const mapParams: {
      focusUserId: string;
      focusLat?: number;
      focusLng?: number;
    } = { focusUserId: userId };
    if (
      profile?.mapLat != null &&
      profile?.mapLng != null &&
      Number.isFinite(profile.mapLat) &&
      Number.isFinite(profile.mapLng)
    ) {
      mapParams.focusLat = profile.mapLat;
      mapParams.focusLng = profile.mapLng;
    }
    // CommonActions + nested params so an already-mounted Main/Map receives focus*
    // even when the stack is already under UserProfile.
    navigation.dispatch(
      CommonActions.navigate({
        name: 'Main',
        params: {
          screen: 'Map',
          params: mapParams,
        },
      }),
    );
  };

  const block = async (): Promise<void> => {
    setBlocking(true);
    try {
      await postJson<undefined, { blocked: boolean }>(`/blocks/${userId}`, undefined);
      Alert.alert(
        'Blocked',
        `You won't see ${profile?.displayName ?? 'this user'} or hear from them.`,
        [{ text: 'OK', onPress: () => navigation.goBack() }],
        { cancelable: false },
      );
    } catch {
      Alert.alert('Could not block', 'Try again in a moment.');
    } finally {
      setBlocking(false);
    }
  };

  const unblock = async (): Promise<void> => {
    setBlocking(true);
    try {
      await deleteJson<{ blocked: boolean }>(`/blocks/${userId}`);
      setProfile((p) => (p ? { ...p, blockedByViewer: false } : p));
      await loadRelationship();
    } catch {
      Alert.alert('Could not unblock', 'Try again in a moment.');
    } finally {
      setBlocking(false);
    }
  };

  const confirmBlock = (): void => {
    Alert.alert(
      `Block ${profile?.displayName ?? 'this user'}?`,
      "They won't appear on your map and neither of you can message the other. You can undo this in Settings → Blocked users.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void block() },
      ],
    );
  };

  const runSocial = async (
    fn: () => Promise<void>,
    setBusy: (v: boolean) => void,
  ): Promise<void> => {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Could not update', errMessage(e, 'Try again in a moment.'));
    } finally {
      await loadRelationship();
      setBusy(false);
    }
  };

  const openMenu = (): void => {
    const name = profile?.displayName ?? 'this user';
    const dismiss = (): void => {
      optionsRef.current?.dismiss();
    };

    let items: ActionSheetItem[];
    if (blocked) {
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
            Alert.alert('Unfriend', `Remove ${name} from friends?`, [
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
          Alert.alert(
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

  const onFollowToggle = (): void => {
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
      await postJson<{ userId: string }, { following: true }>('/friends/follow', { userId });
    }, setFollowBusy);
  };

  const onFriendAction = (): void => {
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
  };

  const openMutualFriends = (): void => {
    if (!rel || rel.mutualFriendsCount < 1) return;
    navigation.navigate('MutualFriends', {
      peerUserId: userId,
      ...(profile?.displayName ? { peerName: profile.displayName } : {}),
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!profile) return <View style={styles.centered} />;

  const badges = earnedBadges(profile.verification);
  const isFollowing = Boolean(rel?.isFollowing);
  const friendLabel =
    rel?.state === 'friends'
      ? 'Friends'
      : rel?.state === 'request_outgoing'
        ? 'Requested'
        : rel?.state === 'request_incoming'
          ? 'Accept'
          : 'Add friend';
  const hometown = [profile.hometownCity, profile.hometownCountry].filter(Boolean).join(', ');
  const showMessage = !blocked && (canMessage === 'chat' || canMessage === 'request');

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuBtn}
          onPress={openMenu}
          disabled={blocking}
          accessibilityLabel="Profile options"
        >
          <Text style={styles.menuBtnText}>···</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBlock}>
          <View style={styles.cover}>
            {coverUri ? (
              <Image source={{ uri: coverUri }} style={styles.coverImage} />
            ) : (
              <View style={styles.coverPlaceholder} />
            )}
            <View style={styles.coverScrim} />
          </View>
          <View style={styles.avatarWrap}>
            <Avatar uri={profile.avatarUrl} name={profile.displayName} size={96} ring />
          </View>
          <View style={styles.heroMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName} numberOfLines={1}>
                {profile.displayName}
                {profile.age != null ? `, ${profile.age}` : ''}
              </Text>
              <VerificationBadge
                verification={profile.verification}
                idVerified={profile.idVerified}
                size={18}
              />
            </View>
            {hometown ? <Text style={styles.originLine}>{hometown}</Text> : null}
            <View style={styles.placeRow}>
              {profile.online ? (
                <Text style={styles.onlineLabel}>Online now</Text>
              ) : null}
              {profile.distanceMeters != null ? (
                <>
                  {profile.online ? <Text style={styles.placeDot}>·</Text> : null}
                  <Text style={styles.distanceLabel}>
                    {formatDistanceAway(profile.distanceMeters)}
                  </Text>
                </>
              ) : !profile.online ? (
                <Text style={styles.offlineLabel}>Recently nearby</Text>
              ) : null}
              <Text style={styles.placeDot}>·</Text>
              <TouchableOpacity onPress={viewOnMap} hitSlop={8} accessibilityRole="button">
                <Text style={styles.viewOnMap}>View on map</Text>
              </TouchableOpacity>
            </View>
            {rel && rel.mutualFriendsCount > 0 ? (
              <TouchableOpacity onPress={openMutualFriends} accessibilityRole="button">
                <Text style={styles.mutualLine}>
                  {rel.mutualFriendsCount} mutual friend
                  {rel.mutualFriendsCount === 1 ? '' : 's'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {!blocked ? (
          <View style={styles.socialRow}>
            <TouchableOpacity
              style={[styles.outlineBtn, isFollowing && styles.outlineBtnActive]}
              onPress={onFollowToggle}
              disabled={followBusy || friendBusy}
            >
              {followBusy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.outlineBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.outlineBtn,
                (rel?.state === 'friends' || rel?.state === 'request_outgoing') &&
                  styles.outlineBtnActive,
                rel?.state === 'request_incoming' && styles.outlineBtnAccent,
              ]}
              onPress={onFriendAction}
              disabled={friendBusy || followBusy || rel?.state === 'friends'}
            >
              {friendBusy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.outlineBtnText}>{friendLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Reordered: Trust → About → Storyline → Photos → Goals */}
        <View>
          <Text style={styles.sectionLabel}>Trust</Text>
          <View style={styles.trustCompact}>
            <Text style={styles.trustText}>{profile.verificationScore}% verified</Text>
            <View style={styles.trustBadges}>
              {badges.length === 0 ? (
                <Text style={styles.trustEmpty}>No verification yet</Text>
              ) : (
                badges.map((b) => (
                  <View key={b} style={[styles.trustChip, b === 'ID' && styles.trustChipStrong]}>
                    <Text style={b === 'ID' ? styles.trustChipStrongText : styles.trustChipText}>
                      {b}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </View>

        {profile.bio ? <ProfileBio bio={profile.bio} showTitle padded={false} /> : null}

        <View style={styles.section}>
          <ProfileStoryline userId={userId} />
        </View>

        <ProfilePhotosSection photos={photoUrls} isSelf={false} padded={false} />

        <ProfileTagsSection goals={profile.goals ?? []} goalsTitle="Goals" padded={false} />
      </ScrollView>

      <View style={styles.footer}>
        {blocked ? (
          <TouchableOpacity style={styles.unblockBtn} onPress={() => void unblock()} disabled={blocking}>
            <Text style={styles.unblockBtnText}>Unblock</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity
              style={[styles.footerBtn, styles.waveBtn, waving && styles.btnDisabled]}
              onPress={() => void sendWave()}
              disabled={waving}
            >
              <Text style={styles.footerBtnTextOnPrimary}>
                {waving ? '…' : '👋 Wave'}
              </Text>
            </TouchableOpacity>
            {showMessage ? (
              <TouchableOpacity
                style={[styles.footerBtn, styles.messageBtn, messaging && styles.btnDisabled]}
                onPress={() => void openMessage()}
                disabled={messaging}
              >
                <Text style={styles.footerBtnTextOnPrimary}>
                  {messaging ? '…' : canMessage === 'request' ? '✉️ Message' : '💬 Chat'}
                </Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity style={[styles.footerBtn, styles.giftBtn]} onPress={() => setGiftSheetOpen(true)}>
              <Text style={styles.giftBtnText}>🎁</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <SendGiftSheet
        visible={giftSheetOpen}
        onClose={() => setGiftSheetOpen(false)}
        recipientId={userId}
        recipientName={profile.displayName}
      />

      <BottomSheetModal
        ref={optionsRef}
        snapPoints={optionsSnap}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        backgroundStyle={sheetChrome.background}
        handleIndicatorStyle={sheetChrome.handle}
      >
        <BottomSheetView style={sheetChrome.content}>
          <ActionSheetList title={profile.displayName} items={menuItems} />
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 12,
    paddingBottom: 4,
    zIndex: 2,
  },
  backBtn: { padding: 8 },
  backBtnText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  menuBtn: { padding: 8 },
  menuBtnText: { color: colors.textMuted, fontSize: 22, letterSpacing: 2 },
  scroll: { paddingBottom: 24, gap: 22 },

  heroBlock: { marginBottom: 4 },
  cover: {
    height: 140,
    backgroundColor: colors.surfaceRaised,
    overflow: 'hidden',
  },
  coverImage: { width: '100%', height: '100%', opacity: 0.55 },
  coverPlaceholder: { flex: 1, backgroundColor: colors.surfaceAlt },
  coverScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,15,0.35)',
  },
  avatarWrap: {
    alignItems: 'center',
    marginTop: -48,
  },
  heroMeta: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    marginTop: 10,
    gap: 4,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  displayName: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  originLine: { color: colors.textMuted, fontSize: 13 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  onlineLabel: { color: colors.success, fontSize: 13 },
  offlineLabel: { color: colors.textFaint },
  distanceLabel: { color: colors.textMuted, fontSize: 13 },
  placeDot: { color: colors.textFaint, fontSize: 13 },
  viewOnMap: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  mutualLine: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: '600' },

  socialRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.xl,
  },
  outlineBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  outlineBtnActive: {
    borderColor: colors.primary,
  },
  outlineBtnAccent: {
    borderColor: colors.primary,
    backgroundColor: '#00d4ff12',
  },
  outlineBtnText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },

  section: { paddingHorizontal: spacing.xl, gap: 10 },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: spacing.xl,
    marginBottom: 8,
  },
  trustCompact: {
    paddingHorizontal: spacing.xl,
    gap: 10,
  },
  trustText: { color: colors.textMuted, fontSize: 12 },
  trustBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  trustChip: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trustChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  trustChipStrong: { backgroundColor: '#00d4ff20' },
  trustChipStrongText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  trustEmpty: { color: colors.textFaint, fontSize: 12 },

  footer: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: spacing.xl,
    paddingTop: 12,
    paddingBottom: 36,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.bg,
  },
  footerBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  waveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  messageBtn: {
    flex: 1,
    backgroundColor: colors.primary,
  },
  giftBtn: {
    width: 56,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: '#00d4ff66',
  },
  footerBtnTextOnPrimary: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  giftBtnText: { fontSize: 20 },
  btnDisabled: { opacity: 0.55 },
  unblockBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: '#ff6b6b66',
  },
  unblockBtnText: { color: '#ff6b6b', fontWeight: '700', fontSize: 16 },
});
