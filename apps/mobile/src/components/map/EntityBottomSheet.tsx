import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { colors } from '@/theme';
import { styles } from './EntityBottomSheet.styles';

const LADDER: VerificationLevel[] = ['none', 'email', 'phone', 'selfie', 'id'];
const LADDER_BADGES: Array<{ level: VerificationLevel; label: string }> = [
  { level: 'email', label: 'Email' },
  { level: 'phone', label: 'Phone' },
  { level: 'selfie', label: 'Photo' },
  { level: 'id', label: 'ID' },
];

/** Short TTL cache so re-opening the same pin does not triple-fetch. */
const PROFILE_CACHE_TTL_MS = 45_000;
const profileCache = new Map<
  string,
  { profile: PublicUserProfile; fetchedAt: number }
>();

function getCachedProfile(userId: string): PublicUserProfile | null {
  const hit = profileCache.get(userId);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > PROFILE_CACHE_TTL_MS) {
    profileCache.delete(userId);
    return null;
  }
  return hit.profile;
}

function setCachedProfile(userId: string, profile: PublicUserProfile): void {
  profileCache.set(userId, { profile, fetchedAt: Date.now() });
}

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
  const cached = getCachedProfile(point.id);
  const [profile, setProfile] = useState<PublicUserProfile | null>(cached);
  const [fetching, setFetching] = useState(cached == null);
  const [fetchError, setFetchError] = useState(false);
  const [opening, setOpening] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [mutualCount, setMutualCount] = useState(0);
  const [mutualPreview, setMutualPreview] = useState<FriendCard[]>([]);
  const [reloadToken, setReloadToken] = useState(0);

  const loadProfile = useCallback(async (userId: string): Promise<void> => {
    const hit = getCachedProfile(userId);
    if (hit) {
      setProfile(hit);
      setFetching(false);
      setFetchError(false);
      return;
    }
    setFetching(true);
    setFetchError(false);
    try {
      const p = await getJson<PublicUserProfile>(`/users/${userId}`);
      setCachedProfile(userId, p);
      setProfile(p);
      setFetchError(false);
    } catch {
      setFetchError(true);
      // Keep any previous profile so Wave/Profile still work from discovery meta.
    } finally {
      setFetching(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Sync reset — no setTimeout(0).
    setMutualCount(0);
    setMutualPreview([]);
    setOpening(false);
    setBlocking(false);

    const hit = getCachedProfile(point.id);
    if (hit) {
      setProfile(hit);
      setFetching(false);
      setFetchError(false);
    } else {
      setProfile(null);
      setFetching(true);
      setFetchError(false);
    }

    void (async () => {
      if (cancelled) return;
      await loadProfile(point.id);
    })();

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
  }, [point.id, reloadToken, loadProfile]);

  const onRetryProfile = (): void => {
    profileCache.delete(point.id);
    setReloadToken((t) => t + 1);
  };

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
      ...(displayName ? { peerName: displayName } : {}),
    });
  };

  const runBlockToggle = async (): Promise<void> => {
    if (blocking) return;
    setBlocking(true);
    try {
      if (blocked) {
        await deleteJson<{ blocked: boolean }>(`/blocks/${point.id}`);
        setProfile((p) => {
          if (!p) return p;
          const next = { ...p, blockedByViewer: false };
          setCachedProfile(point.id, next);
          return next;
        });
      } else {
        await postJson<undefined, { blocked: boolean }>(`/blocks/${point.id}`, undefined);
        setProfile((p) => {
          if (!p) return p;
          const next = { ...p, blockedByViewer: true };
          setCachedProfile(point.id, next);
          return next;
        });
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
      >('/conversations', { targetUserId: point.id });
      onClose();
      openRootScreen(navigation, 'Chat', {
        conversationId: res.conversationId,
        otherUserName: displayName,
        otherUserId: point.id,
        requestPending: res.status === 'pending' && res.permission === 'request',
        ...(profile?.verification != null
          ? { otherUserVerification: profile.verification }
          : {}),
        otherUserIdVerified: profile?.idVerified ?? false,
      });
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? String((e as { message: unknown }).message)
          : 'Try again in a moment.';
      appAlert('Could not open chat', msg);
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
          disabled={blocking || (fetching && profile == null)}
          accessibilityRole="button"
          accessibilityLabel="More actions"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.overflowBtnText}>···</Text>
        </TouchableOpacity>
      </View>

      {fetching && profile == null ? (
        <ActivityIndicator color={colors.primary} size="small" style={{ alignSelf: 'flex-start' }} />
      ) : null}

      {fetchError && profile == null ? (
        <View style={styles.fetchErrorRow}>
          <Text style={styles.fetchErrorText}>Could not load profile</Text>
          <TouchableOpacity
            onPress={onRetryProfile}
            accessibilityRole="button"
            accessibilityLabel="Retry loading profile"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          >
            <Text style={styles.fetchErrorRetry}>Retry</Text>
          </TouchableOpacity>
        </View>
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
                style={[styles.mutualAvatarWrap, i > 0 ? styles.mutualAvatarOverlap : undefined]}
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
            style={[styles.primaryBtn, styles.waveBtn, waving ? styles.btnDisabled : undefined]}
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
            style={[styles.primaryBtn, styles.messageBtn, opening ? styles.btnDisabled : undefined]}
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
            <Text style={styles.trustText}>
              {trustScore != null ? `${trustScore}%` : '0%'}
            </Text>
          </View>
          <View style={styles.trustBadges}>
            {badges.length === 0 ? (
              <Text style={styles.trustEmpty}>No verification yet</Text>
            ) : (
              badges.map((b) => (
                <View key={b} style={[styles.trustChip, b === 'ID' ? styles.trustChipStrong : undefined]}>
                  <Text style={b === 'ID' ? styles.trustChipStrongText : styles.trustChipText}>
                    {b}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>
      ) : null}

      {!fetching && hasStats ? (
        <View style={styles.statsBlock}>
          <Text style={styles.sectionLabel}>Stats</Text>
          <View style={styles.statsRow}>
            {status?.level != null ? (
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>Lv {status.level}</Text>
              </View>
            ) : null}
            {allTimeRank != null ? (
              <View style={styles.statPill}>
                <Text style={styles.statPillValue}>#{allTimeRank}</Text>
              </View>
            ) : null}
            {achievementIcons.length > 0 ? (
              <View style={styles.achievementIcons}>
                {achievementIcons.slice(0, 3).map((icon, i) => (
                  <Text key={`${icon}-${i}`} style={styles.achievementIcon}>
                    {icon}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {profile?.bio ? (
        <Text style={styles.bio} numberOfLines={3}>
          {profile.bio}
        </Text>
      ) : null}
    </View>
  );
}

function EventCard({
  point,
  onClose,
}: {
  point: EventEntityPoint;
  onClose: () => void;
}): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const meta = point.meta;
  const title = meta.title?.trim() || 'Event';
  const capacity =
    meta.capacity != null && meta.capacity > 0
      ? `${meta.attendeeCount}/${meta.capacity} going`
      : `${meta.attendeeCount} going`;

  const openDetail = (): void => {
    onClose();
    openRootScreen(navigation, 'EventDetail', { eventId: point.id });
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.kindHeader}>
        <View style={[styles.kindDot, styles.kindDotEvent]} />
        <Text style={styles.kindLabel}>Event</Text>
      </View>
      <Text style={styles.entityTitle} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaText}>{formatStartsAt(meta.startsAt)}</Text>
        <Text style={styles.metaDot}>·</Text>
        <Text style={styles.metaText}>{capacity}</Text>
      </View>
      <TouchableOpacity
        style={[styles.primaryBtn, styles.entityPrimaryBtn]}
        onPress={openDetail}
        accessibilityRole="button"
        accessibilityLabel="View event"
      >
        <Text style={styles.primaryBtnText}>View event</Text>
      </TouchableOpacity>
    </View>
  );
}

function ListingCard({
  point,
  onClose,
}: {
  point: ListingEntityPoint;
  onClose: () => void;
}): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const meta = point.meta;
  const title = meta.title?.trim() || 'Listing';
  const isBuy = meta.mode === 'buy';
  const mode = isBuy ? 'Wanted' : 'For sale';
  const price = formatPrice(meta.priceCents, meta.currency);
  const category = meta.category?.trim() || null;

  const openDetail = (): void => {
    onClose();
    openRootScreen(navigation, 'ListingDetail', { listingId: point.id });
  };

  return (
    <View style={styles.sheet}>
      <View style={styles.kindHeader}>
        <View
          style={[
            styles.kindDot,
            isBuy ? styles.kindDotWanted : styles.kindDotListing,
          ]}
        />
        <Text style={[styles.kindLabel, isBuy ? styles.kindLabelWanted : undefined]}>{mode}</Text>
      </View>
      <Text style={styles.entityTitle} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.metaRow}>
        <Text style={styles.priceText}>{price}</Text>
        {category ? (
          <>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{category}</Text>
          </>
        ) : null}
      </View>
      <TouchableOpacity
        style={[styles.primaryBtn, styles.entityPrimaryBtn, styles.listingPrimaryBtn]}
        onPress={openDetail}
        accessibilityRole="button"
        accessibilityLabel="View listing"
      >
        <Text style={styles.primaryBtnText}>View listing</Text>
      </TouchableOpacity>
    </View>
  );
}

/** Content only — host mounts inside BottomSheetModal. */
export function EntityBottomSheet({ point, waving, onClose, onWave }: Props): React.JSX.Element {
  if (point.kind === 'user') {
    return (
      <UserCard
        point={point as UserEntityPoint}
        waving={waving}
        onClose={onClose}
        onWave={onWave}
      />
    );
  }

  if (point.kind === 'event') {
    return <EventCard point={point as EventEntityPoint} onClose={onClose} />;
  }

  if (point.kind === 'listing') {
    return <ListingCard point={point as ListingEntityPoint} onClose={onClose} />;
  }

  return (
    <View style={styles.sheet}>
      <Text style={styles.entityTitle}>Unknown</Text>
      <TouchableOpacity style={[styles.primaryBtn, styles.entityPrimaryBtn]} onPress={onClose}>
        <Text style={styles.primaryBtnText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}
