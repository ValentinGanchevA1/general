import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  CreateConversationRequest,
  CreateConversationResponse,
  EntityPoint,
  EventMeta,
  FriendCard,
  FriendsPage,
  ListingMeta,
  PublicUserProfile,
  RelationshipSummary,
  UserMeta,
  VerificationLevel,
} from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { deleteJson, getJson, postJson } from '@/api/client';
import { IdentityBlock } from '@/components/IdentityBlock';
import { colors, radius, spacing } from '@/theme';

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

function formatStartsAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return d.toISOString();
  }
}

function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    }).format(amount);
  } catch {
    return `${(currency || 'USD').toUpperCase()} ${amount.toFixed(2)}`;
  }
}

type UserEntityPoint = EntityPoint & { kind: 'user'; meta: UserMeta };
type EventEntityPoint = EntityPoint & { kind: 'event'; meta: EventMeta };
type ListingEntityPoint = EntityPoint & { kind: 'listing'; meta: ListingMeta };

interface Props {
  point: EntityPoint;
  waving: boolean;
  onClose: () => void;
  onWave?: () => void;
}

interface UserCardProps {
  point: UserEntityPoint;
  waving: boolean;
  onClose: () => void;
  onWave?: (() => void) | undefined;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

function UserCard({ point, waving, onWave, onClose }: UserCardProps): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [fetching, setFetching] = useState(true);
  const [opening, setOpening] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [mutualCount, setMutualCount] = useState(0);
  const [mutualPreview, setMutualPreview] = useState<FriendCard[]>([]);

  useEffect(() => {
    let cancelled = false;
    setMutualCount(0);
    setMutualPreview([]);
    setFetching(true);

    void getJson<PublicUserProfile>(`/users/${point.id}`)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetching(false);
      });

    void (async () => {
      try {
        const rel = await getJson<RelationshipSummary>(`/friends/relationship/${point.id}`);
        if (cancelled) return;
        const count = rel.mutualFriendsCount ?? 0;
        setMutualCount(count);
        if (count < 1) return;
        const page = await getJson<FriendsPage>(`/friends/mutual/${point.id}?limit=3`);
        if (!cancelled) setMutualPreview(page.items.slice(0, 3));
      } catch {
        /* mutual is additive — ignore failures */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [point.id]);

  const meta = point.meta;
  const displayName = meta.displayName?.trim() || 'User';
  const canMessage = profile?.relationship?.canMessage ?? 'none';
  const blocked = profile?.blockedByViewer ?? false;
  const status = profile?.status;
  const trustScore = profile?.verificationScore;
  const badges = profile ? earnedBadges(profile.verification) : [];
  const achievementIcons = status?.achievementIcons ?? [];
  const allTimeRank = status?.allTimeRank ?? null;
  const hasStats =
    status != null || allTimeRank != null || achievementIcons.length > 0;

  const isFriend = meta.isFriend === true;
  const idVerified = profile?.idVerified === true;
  const ringVariant = idVerified ? 'verified' : isFriend ? 'friend' : 'brand';

  const subtitle = (() => {
    if (profile == null) return null;
    const parts: string[] = [];
    if (profile.age != null) parts.push(`${profile.age}`);
    const home = [profile.hometownCity, profile.hometownCountry].filter(Boolean).join(', ');
    if (home) parts.push(home);
    return parts.length > 0 ? parts.join(' · ') : null;
  })();

  const openProfile = (): void => {
    onClose();
    navigation.navigate('UserProfile', { userId: point.id });
  };

  const openMutualFriends = (): void => {
    if (mutualCount < 1) return;
    onClose();
    navigation.navigate('MutualFriends', {
      peerUserId: point.id,
      peerName: displayName,
    });
  };

  const runBlockToggle = async (): Promise<void> => {
    if (blocking) return;
    setBlocking(true);
    try {
      if (blocked) {
        await deleteJson<{ blocked: boolean }>(`/blocks/${point.id}`);
        setProfile((p) => (p ? { ...p, blockedByViewer: false } : p));
      } else {
        await postJson<undefined, { blocked: boolean }>(`/blocks/${point.id}`, undefined);
        setProfile((p) => (p ? { ...p, blockedByViewer: true } : p));
        onClose();
      }
    } catch {
      appAlert('Could not update block', 'Try again in a moment.');
    } finally {
      setBlocking(false);
    }
  };

  const onOverflow = (): void => {
    if (blocking) return;
    if (blocked) {
      appAlert(displayName, undefined, [
        { text: 'Unblock', onPress: () => void runBlockToggle() },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    appAlert(displayName, undefined, [
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          appAlert(
            'Block this user?',
            'They will not be able to wave or message you. You can unblock later in Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Block', style: 'destructive', onPress: () => void runBlockToggle() },
            ],
          );
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const onMessage = async (): Promise<void> => {
    if (opening || canMessage === 'none' || blocked) return;
    setOpening(true);
    try {
      const res = await postJson<
        CreateConversationRequest,
        CreateConversationResponse
      >('/chat/conversations', { targetUserId: point.id });
      onClose();
      navigation.navigate('Chat', {
        conversationId: res.conversationId,
        otherUserName: displayName,
        otherUserId: point.id,
        requestPending: res.status === 'pending',
      });
    } catch {
      appAlert('Could not open chat', 'Try again in a moment.');
    } finally {
      setOpening(false);
    }
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.userHeader}>
        <View style={styles.userHeaderMain}>
          <IdentityBlock
            name={displayName}
            avatarUrl={meta.avatarUrl ?? null}
            verification={meta.verification ?? profile?.verification ?? 'none'}
            idVerified={idVerified}
            online={meta.online}
            subtitle={subtitle}
            ringVariant={ringVariant}
            size={56}
            onPress={openProfile}
          />
        </View>
        <TouchableOpacity
          style={styles.overflowBtn}
          onPress={onOverflow}
          disabled={blocking || fetching}
          accessibilityRole="button"
          accessibilityLabel="More actions"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.overflowBtnText}>···</Text>
        </TouchableOpacity>
      </View>

      {fetching ? (
        <ActivityIndicator color={colors.primary} size="small" style={{ alignSelf: 'flex-start' }} />
      ) : null}

      {!fetching && mutualCount > 0 ? (
        <TouchableOpacity
          style={styles.mutualRow}
          onPress={openMutualFriends}
          accessibilityRole="button"
          accessibilityLabel={`${mutualCount} mutual friends`}
        >
          <View style={styles.mutualAvatars}>
            {mutualPreview.map((f, i) => (
              <View
                key={f.userId}
                style={[styles.mutualAvatarWrap, i > 0 ? styles.mutualAvatarOverlap : null]}
              >
                {f.avatarUrl ? (
                  <Image source={{ uri: f.avatarUrl }} style={styles.mutualAvatar} />
                ) : (
                  <View style={[styles.mutualAvatar, styles.mutualAvatarPlaceholder]}>
                    <Text style={styles.mutualInitial}>
                      {(f.displayName[0] ?? '?').toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            ))}
          </View>
          <Text style={styles.mutualText}>
            {mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.actions}>
        {onWave && !blocked ? (
          <TouchableOpacity
            style={[styles.primaryBtn, styles.waveBtn, waving && styles.btnDisabled]}
            onPress={onWave}
            disabled={waving}
            accessibilityRole="button"
            accessibilityLabel="Wave"
          >
            <Text style={styles.primaryBtnText}>{waving ? '…' : 'Wave'}</Text>
          </TouchableOpacity>
        ) : null}
        {canMessage !== 'none' && !blocked ? (
          <TouchableOpacity
            style={[styles.primaryBtn, styles.messageBtn, opening && styles.btnDisabled]}
            onPress={() => void onMessage()}
            disabled={opening}
            accessibilityRole="button"
            accessibilityLabel="Message"
          >
            <Text style={styles.primaryBtnText}>{opening ? '…' : 'Message'}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={openProfile}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
        >
          <Text style={styles.profileBtnText}>Profile</Text>
        </TouchableOpacity>
      </View>

      {!fetching && profile != null ? (
        <View style={styles.trustBlock}>
          <View style={styles.trustHeader}>
            <Text style={styles.sectionLabel}>Trust</Text>
            {trustScore != null ? (
              <Text style={styles.trustScore}>{trustScore}</Text>
            ) : null}
          </View>
          {badges.length > 0 ? (
            <View style={styles.badgeRow}>
              {badges.map((b) => (
                <View key={b} style={styles.badge}>
                  <Text style={styles.badgeText}>{b}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.trustEmpty}>No verification steps yet</Text>
          )}
        </View>
      ) : null}

      {!fetching && hasStats ? (
        <View style={styles.statsBlock}>
          <Text style={styles.sectionLabel}>Stats</Text>
          <View style={styles.statsRow}>
            {status != null ? (
              <Text style={styles.statText}>Lv {status.level}</Text>
            ) : null}
            {allTimeRank != null ? (
              <Text style={styles.statText}>#{allTimeRank}</Text>
            ) : null}
            {achievementIcons.length > 0 ? (
              <Text style={styles.statText}>{achievementIcons.join(' ')}</Text>
            ) : null}
          </View>
        </View>
      ) : null}

      {!fetching && profile?.bio ? (
        <Text style={styles.bio} numberOfLines={4}>
          {profile.bio}
        </Text>
      ) : null}
    </View>
  );
}
