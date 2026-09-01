import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  PublicUserProfile,
  UserMeta,
  VerificationLevel,
} from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { deleteJson, getJson, postJson } from '@/api/client';
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Avatar } from '@/components/Avatar';
import { colors, spacing } from '@/theme';

function labelFor(value: string): string {
  return GOAL_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

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

type UserEntityPoint = EntityPoint & { kind: 'user'; meta: UserMeta };

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

  useEffect(() => {
    let cancelled = false;
    getJson<PublicUserProfile>(`/users/${point.id}`)
      .then((p) => {
        if (!cancelled) setProfile(p);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFetching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [point.id]);

  const meta = point.meta;
  const displayName = meta.displayName?.trim() || 'User';
  const canMessage = profile?.relationship?.canMessage ?? 'none';
  const sharedInterests = profile?.relationship?.sharedInterests ?? [];
  const goalChips =
    (profile?.goals?.length ? profile.goals : sharedInterests).slice(0, 6);
  const blocked = profile?.blockedByViewer ?? false;
  const status = profile?.status;
  const trustScore = profile?.verificationScore;
  const badges = profile ? earnedBadges(profile.verification) : [];

  const onBlockToggle = (): void => {
    if (blocking) return;
    const doBlock = async (): Promise<void> => {
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
    if (blocked) {
      void doBlock();
      return;
    }
    appAlert(
      'Block this user?',
      'They will not be able to wave or message you. You can unblock later in Settings.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Block', style: 'destructive', onPress: () => void doBlock() },
      ],
    );
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
        <TouchableOpacity
          style={styles.userHeaderTap}
          onPress={() => {
            onClose();
            navigation.navigate('UserProfile', { userId: point.id });
          }}
          activeOpacity={0.85}
        >
          <Avatar uri={meta.avatarUrl ?? null} name={displayName} size={56} />
          <View style={styles.userHeaderText}>
            <View style={styles.nameRow}>
              <Text style={styles.title} numberOfLines={1}>
                {displayName}
              </Text>
              <VerificationBadge
                verification={meta.verification ?? 'none'}
                idVerified={profile?.idVerified}
                size={16}
              />
            </View>
            {profile?.age != null ? (
              <Text style={styles.originLine}>{profile.age} years</Text>
            ) : null}
            {profile?.hometownCity || profile?.hometownCountry ? (
              <Text style={styles.originLine} numberOfLines={1}>
                {[profile.hometownCity, profile.hometownCountry].filter(Boolean).join(', ')}
              </Text>
            ) : null}
            {meta.online ? (
              <Text style={styles.onlineLabel}>Online</Text>
            ) : (
              <Text style={[styles.onlineLabel, styles.offlineLabel]}>Offline</Text>
            )}
          </View>
        </TouchableOpacity>
      </View>

      {fetching ? (
        <ActivityIndicator color={colors.primary} size="small" style={{ alignSelf: 'flex-start' }} />
      ) : null}

      {/* Trust — under avatar, before bio */}
      {!fetching && profile != null ? (
        <View style={styles.trustBlock}>
          <Text style={styles.trustLabel}>Trust</Text>
          <Text style={styles.trustText}>
            {trustScore != null ? `${trustScore}% verified` : '0% verified'}
          </Text>
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
      ) : null}

      {profile?.bio ? (
        <Text style={styles.bio} numberOfLines={3}>
          {profile.bio}
        </Text>
      ) : null}

      {goalChips.length > 0 ? (
        <View style={styles.goalsRow}>
          {goalChips.map((g) => (
            <View key={g} style={styles.goalChip}>
              <Text style={styles.goalIcon}>✓</Text>
              <Text style={styles.goalLabel}>{labelFor(g)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* Level (number + bar only) + badges under goals */}
      {status || badges.length > 0 ? (
        <View style={styles.statusBlock}>
          {status ? (
            <>
              <Text style={styles.statusLevel}>Level {status.level}</Text>
              <View style={styles.xpTrack}>
                <View
                  style={[
                    styles.xpFill,
                    {
                      width: `${Math.min(
                        100,
                        Math.round(
                          (status.xpIntoLevel / Math.max(1, status.xpForNextLevel)) * 100,
                        ),
                      )}%`,
                    },
                  ]}
                />
              </View>
            </>
          ) : null}
          {badges.length > 0 ? (
            <View style={styles.badgesRow}>
              {badges.map((b) => (
                <View key={b} style={[styles.badgeChip, b === 'ID' && styles.trustChipStrong]}>
                  <Text style={b === 'ID' ? styles.trustChipStrongText : styles.badgeChipText}>
                    {b}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      <View style={styles.actions}>
        {onWave && !blocked ? (
          <TouchableOpacity
            style={[styles.primaryBtn, styles.waveBtn, waving && styles.btnDisabled]}
            onPress={onWave}
            disabled={waving}
          >
            <Text style={styles.primaryBtnText}>{waving ? '…' : 'Wave'}</Text>
          </TouchableOpacity>
        ) : null}
        {canMessage !== 'none' && !blocked ? (
          <TouchableOpacity
            style={[styles.primaryBtn, styles.messageBtn, opening && styles.btnDisabled]}
            onPress={() => void onMessage()}
            disabled={opening}
          >
            <Text style={styles.primaryBtnText}>{opening ? '…' : 'Message'}</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => {
            onClose();
            navigation.navigate('UserProfile', { userId: point.id });
          }}
        >
          <Text style={styles.profileBtnText}>Profile</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.blockLink} onPress={onBlockToggle} disabled={blocking}>
        <Text style={[styles.blockLinkText, blocked && styles.unblockLinkText]}>
          {blocked ? 'Unblock' : 'Block'}
        </Text>
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

  const title =
    point.kind === 'event'
      ? (point.meta as { title?: string }).title ?? 'Event'
      : point.kind === 'listing'
        ? (point.meta as { title?: string }).title ?? 'Listing'
        : 'Place';

  return (
    <View style={styles.sheet}>
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{point.kind}</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.viewBtn} onPress={onClose}>
        <Text style={styles.viewBtnText}>Close</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: 14,
  },
  userHeaderTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userHeaderText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  originLine: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  onlineLabel: { color: colors.success, fontSize: 12, marginTop: 2 },
  offlineLabel: { color: colors.textMuted },
  trustBlock: { gap: 6 },
  trustLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trustText: { color: colors.textMuted, fontSize: 12 },
  trustBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
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
  bio: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  goalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.bg,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  goalIcon: { fontSize: 13 },
  goalLabel: { color: colors.textSecondary, fontSize: 12 },
  statusBlock: {
    backgroundColor: colors.bg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  statusLevel: { color: colors.textPrimary, fontWeight: '700', fontSize: 14 },
  xpTrack: {
    height: 6,
    backgroundColor: colors.borderStrong,
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  badgeChip: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  blockLink: { alignSelf: 'center', paddingVertical: 4 },
  blockLinkText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  unblockLinkText: { color: colors.info },
  primaryBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  waveBtn: { backgroundColor: colors.primary },
  messageBtn: { backgroundColor: colors.action },
  primaryBtnText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
  profileBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    minHeight: 48,
  },
  profileBtnText: { color: colors.textSecondary, fontWeight: '600', fontSize: 14 },
  btnDisabled: { opacity: 0.55 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleGroup: { flex: 1 },
  title: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
  subtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  viewBtn: {
    marginTop: 8,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewBtnText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
});
