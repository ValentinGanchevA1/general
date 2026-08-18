import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type {
  ApiError,
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

export function UserProfileScreen({ route, navigation }: Props): React.JSX.Element {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [rel, setRel] = useState<RelationshipSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [waving, setWaving] = useState(false);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [friendBusy, setFriendBusy] = useState(false);

  const blocked = profile?.blockedByViewer ?? false;

  const loadRelationship = useCallback(async () => {
    try {
      const data = await getJson<RelationshipSummary>(`/friends/relationship/${userId}`);
      setRel(data);
    } catch {
      setRel(null);
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
      // Always re-sync from server so optimistic UI cannot stick after a failed write.
      await loadRelationship();
      setBusy(false);
    }
  };

  const openMenu = (): void => {
    if (blocked) {
      Alert.alert('Unblock?', `Unblock ${profile?.displayName ?? 'this user'}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => void unblock() },
      ]);
      return;
    }
    const options: Array<{ text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }> = [];
    if (rel?.state === 'friends') {
      options.push({
        text: 'Unfriend',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Unfriend', `Remove ${profile?.displayName ?? 'them'} from friends?`, [
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
    options.push({ text: 'Block user', style: 'destructive', onPress: confirmBlock });
    options.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(profile?.displayName ?? 'Options', undefined, options);
  };

  const onFollowToggle = (): void => {
    if (followBusy || friendBusy || blocked) return;
    const following = Boolean(rel?.isFollowing);
    if (following) {
      void runSocial(async () => {
        setRel((prev) =>
          prev
            ? {
                ...prev,
                isFollowing: false,
                state:
                  prev.state === 'following'
                    ? 'none'
                    : prev.state === 'mutual_follow'
                      ? 'followed_by'
                      : prev.state,
              }
            : prev,
        );
        await deleteJson<{ following: false }>(`/friends/follow/${userId}`);
      }, setFollowBusy);
      return;
    }
    void runSocial(async () => {
      setRel((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: true,
              state:
                prev.state === 'none' || prev.state === 'followed_by'
                  ? prev.state === 'followed_by'
                    ? 'mutual_follow'
                    : 'following'
                  : prev.state,
            }
          : prev,
      );
      await postJson<{ userId: string }, { following: true }>('/friends/follow', { userId });
    }, setFollowBusy);
  };

  const onFriendAction = (): void => {
    if (friendBusy || followBusy || blocked || !rel) return;
    switch (rel.state) {
      case 'friends':
        return;
      case 'request_outgoing':
        if (rel.requestId) {
          void runSocial(async () => {
            await deleteJson<{ cancelled: true }>(`/friends/requests/${rel.requestId}`);
          }, setFriendBusy);
        }
        return;
      case 'request_incoming':
        if (rel.requestId) {
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
          setRel((prev) =>
            prev
              ? { ...prev, state: 'request_outgoing' as const, requestId: prev.requestId }
              : prev,
          );
          const res = await postJson<{ userId: string }, { requestId: string }>(
            '/friends/requests',
            { userId },
          );
          setRel((prev) =>
            prev
              ? { ...prev, state: 'request_outgoing', requestId: res.requestId }
              : prev,
          );
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
        <View style={styles.hero}>
          <Avatar uri={profile.avatarUrl} name={profile.displayName} size={72} ring />
          <View style={styles.heroMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>
                {profile.displayName}
                {profile.age != null ? `, ${profile.age}` : ''}
              </Text>
              <VerificationBadge
                verification={profile.verification}
                idVerified={profile.idVerified}
                size={18}
              />
            </View>
            {(profile.hometownCity || profile.hometownCountry) ? (
              <Text style={styles.originLine}>
                {[profile.hometownCity, profile.hometownCountry].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            <Text style={[styles.onlineLabel, !profile.online && styles.offlineLabel]}>
              {profile.online ? 'Online now' : 'Recently nearby'}
            </Text>
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
              style={[styles.socialBtn, isFollowing && styles.socialBtnSecondary]}
              onPress={onFollowToggle}
              disabled={followBusy || friendBusy}
            >
              {followBusy ? (
                <ActivityIndicator size="small" color={isFollowing ? colors.primary : colors.onPrimary} />
              ) : (
                <Text
                  style={[styles.socialBtnText, isFollowing && styles.socialBtnTextSecondary]}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.socialBtn,
                (rel?.state === 'friends' || rel?.state === 'request_outgoing') &&
                  styles.socialBtnSecondary,
                rel?.state === 'request_incoming' && styles.socialBtnAccent,
              ]}
              onPress={onFriendAction}
              disabled={friendBusy || followBusy || rel?.state === 'friends'}
            >
              {friendBusy ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text
                  style={[
                    styles.socialBtnText,
                    (rel?.state === 'friends' ||
                      rel?.state === 'request_outgoing' ||
                      rel?.state === 'request_incoming') &&
                      styles.socialBtnTextSecondary,
                  ]}
                >
                  {friendLabel}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        <View>
          <Text style={styles.sectionLabel}>Trust</Text>
          <View style={styles.trustRow}>
            <View style={styles.trustBar}>
              <View style={[styles.trustProgress, { width: `${profile.verificationScore}%` as unknown as number }]} />
            </View>
            <Text style={styles.trustText}>{profile.verificationScore}% verified</Text>
          </View>
          <View style={styles.trustBadges}>
            {badges.length === 0 ? (
              <Text style={styles.trustEmpty}>No verification yet</Text>
            ) : (
              badges.map((b) => (
                <View key={b} style={[styles.trustChip, b === 'ID' && styles.trustChipStrong]}>
                  <Text style={b === 'ID' ? styles.trustChipStrongText : styles.trustChipText}>{b}</Text>
                </View>
              ))
            )}
          </View>
        </View>

        {profile.bio ? (
          <ProfileBio bio={profile.bio} showTitle padded={false} />
        ) : null}

        <ProfileTagsSection
          goals={profile.goals ?? []}
          goalsTitle="Goals"
          padded={false}
        />

        <ProfilePhotosSection
          photos={profile.photoUrls ?? []}
          isSelf={false}
          padded={false}
        />

        <View style={styles.section}>
          <ProfileStoryline userId={userId} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        {blocked ? (
          <TouchableOpacity style={styles.unblockBtn} onPress={() => void unblock()} disabled={blocking}>
            <Text style={styles.unblockBtnText}>Unblock</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity style={styles.giftBtn} onPress={() => setGiftSheetOpen(true)}>
              <Text style={styles.giftBtnText}>🎁 Gift</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.waveBtn, waving && styles.waveBtnDisabled]}
              onPress={() => void sendWave()}
              disabled={waving}
            >
              <Text style={styles.waveBtnText}>{waving ? 'Sending…' : '👋 Send Wave'}</Text>
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
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  backBtnText: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  menuBtn: { padding: 8 },
  menuBtnText: { color: colors.textMuted, fontSize: 22, letterSpacing: 2 },
  scroll: { padding: spacing.xl, gap: 28, paddingBottom: 24 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 8 },
  heroMeta: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  displayName: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  originLine: { color: colors.textMuted, fontSize: 13, marginTop: 2 },
  onlineLabel: { color: colors.success, fontSize: 13 },
  offlineLabel: { color: colors.textFaint },
  mutualLine: { color: colors.primary, fontSize: 12, marginTop: 2, fontWeight: '600' },

  socialRow: { flexDirection: 'row', gap: 10 },
  socialBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  socialBtnSecondary: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  socialBtnAccent: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  socialBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: fontSize.md },
  socialBtnTextSecondary: { color: colors.primary },

  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trustBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 3,
    overflow: 'hidden',
  },
  trustProgress: { height: '100%', backgroundColor: colors.primary, borderRadius: 3 },
  trustText: { color: colors.textMuted, fontSize: 12 },
  trustBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
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
  section: { gap: 10 },
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  footer: { flexDirection: 'row', gap: 12, padding: spacing.xl, paddingBottom: 36 },
  waveBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  waveBtnDisabled: { opacity: 0.6 },
  waveBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 16 },
  giftBtn: {
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: '#00d4ff66',
  },
  giftBtnText: { color: colors.primary, fontWeight: '700', fontSize: 16 },
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
