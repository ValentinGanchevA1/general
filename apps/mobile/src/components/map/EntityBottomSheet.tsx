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
    return parts.length > 0 ? parts.join(' \u00b7 ') : null;
  })();

  const openProfile = (): void => {
    onClose();
    navigation.navigate('UserProfile', { userId: point.id });
  };

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

      {fetching ? (
        <ActivityIndicator color={colors.primary} size="small" style={{ alignSelf: 'flex-start' }} />
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
            <Text style={styles.primaryBtnText}>{waving ? '\u2026' : 'Wave'}</Text>
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
            <Text style={styles.primaryBtnText}>{opening ? '\u2026' : 'Message'}</Text>
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
  sectionLabel: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trustBlock: { gap: 6 },
  trustHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trustText: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
  trustBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  trustChip: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trustChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  trustChipStrong: { backgroundColor: 'rgba(0,212,255,0.12)' },
  trustChipStrongText: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  trustEmpty: { color: colors.textFaint, fontSize: 12 },
  bio: { color: colors.textSecondary, fontSize: 14, lineHeight: 20 },
  statsBlock: { gap: 6 },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  statPill: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statPillValue: { color: colors.textPrimary, fontSize: 13, fontWeight: '700' },
  achievementIcons: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  achievementIcon: { fontSize: 16 },
  actions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  blockLink: { alignSelf: 'center', paddingVertical: 4 },
  blockLinkText: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  unblockLinkText: { color: colors.info },
  primaryBtn: {
    flex: 1,
    borderRadius: radius.md,
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
    borderRadius: radius.md,
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
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center',
  },
  viewBtnText: { color: colors.onPrimary, fontSize: 14, fontWeight: '700' },
});
