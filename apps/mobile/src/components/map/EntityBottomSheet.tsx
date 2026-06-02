import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type {
  CreateConversationRequest,
  CreateConversationResponse,
  EntityPoint,
  PublicUserProfile,
  UserMeta,
} from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getJson, postJson } from '@/api/client';
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';

/** Map a raw interest/goal value to a human label, falling back to the value. */
function labelFor(value: string): string {
  return GOAL_OPTIONS.find((o) => o.value === value)?.label ?? value;
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

function InitialsAvatar({
  name,
  online,
}: {
  name: string;
  online: boolean;
}): React.JSX.Element {
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <View>
      <View style={avatarStyles.circle}>
        <Text style={avatarStyles.text}>{initials}</Text>
      </View>
      {online && <View style={avatarStyles.onlineDot} />}
    </View>
  );
}

const avatarStyles = StyleSheet.create({
  circle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#0a0a1a',
    borderWidth: 2,
    borderColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: '#00d4ff', fontSize: 20, fontWeight: '700' },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#4caf50',
    borderWidth: 2,
    borderColor: '#1a1a2e',
  },
});

// ─── User card ─────────────────────────────────────────────────────────────

function UserCard({ point, waving, onWave, onClose }: UserCardProps): React.JSX.Element {
  const navigation = useNavigation<Nav>();
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [fetching, setFetching] = useState(true);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getJson<PublicUserProfile>(`/users/${point.id}`)
      .then((p) => { if (!cancelled) setProfile(p); })
      .catch(() => { /* degrade gracefully */ })
      .finally(() => { if (!cancelled) setFetching(false); });
    return () => { cancelled = true; };
  }, [point.id]);

  const meta = point.meta;
  const canMessage = profile?.relationship?.canMessage ?? 'none';
  const sharedInterests = profile?.relationship?.sharedInterests ?? [];

  // Open (or fetch) the conversation server-side, then jump into the thread.
  // The server is authoritative — it decides match vs request vs locked.
  const onMessage = async (): Promise<void> => {
    if (opening) return;
    setOpening(true);
    try {
      const res = await postJson<CreateConversationRequest, CreateConversationResponse>(
        '/conversations',
        { targetUserId: point.id },
      );
      onClose();
      navigation.navigate('Chat', {
        conversationId: res.conversationId,
        otherUserName: meta.displayName,
        requestPending: res.status === 'pending' && res.permission === 'request',
      });
    } catch {
      // Gate changed under us (e.g. they went private) — leave the sheet open.
    } finally {
      setOpening(false);
    }
  };

  return (
    <>
      <View style={styles.handle} />

      <View style={styles.userHeader}>
        <InitialsAvatar name={meta.displayName} online={meta.online} />
        <View style={styles.userHeaderText}>
          <View style={styles.nameRow}>
            <Text style={styles.title}>{meta.displayName}</Text>
            {meta.verification !== 'none' && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>✓</Text>
              </View>
            )}
          </View>
          <Text style={[styles.onlineLabel, !meta.online && styles.offlineLabel]}>
            {meta.online ? 'Online now' : 'Recently nearby'}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>

      {fetching ? (
        <ActivityIndicator color="#00d4ff" size="small" style={{ alignSelf: 'flex-start' }} />
      ) : (
        <>
          {profile?.bio ? (
            <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
          ) : null}

          {profile?.goals && profile.goals.length > 0 ? (
            <View style={styles.goalsRow}>
              {profile.goals.slice(0, 3).map((g) => {
                const opt = GOAL_OPTIONS.find((o) => o.value === g);
                return opt ? (
                  <View key={g} style={styles.goalChip}>
                    <Text style={styles.goalIcon}>{opt.icon}</Text>
                    <Text style={styles.goalLabel}>{opt.label}</Text>
                  </View>
                ) : null;
              })}
            </View>
          ) : null}
        </>
      )}

      {canMessage === 'request' && sharedInterests.length > 0 && (
        <Text style={styles.sharedHint}>
          You both like {sharedInterests.slice(0, 2).map(labelFor).join(' · ')}
          {' — say hi'}
        </Text>
      )}

      <View style={styles.actions}>
        {onWave && (
          <TouchableOpacity
            style={[styles.waveBtn, waving && styles.btnDisabled]}
            onPress={onWave}
            disabled={waving}
          >
            {waving ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.waveBtnText}>👋 Wave</Text>
            )}
          </TouchableOpacity>
        )}
        {canMessage !== 'none' && (
          <TouchableOpacity
            style={[styles.messageBtn, opening && styles.btnDisabled]}
            onPress={() => { void onMessage(); }}
            disabled={opening}
          >
            {opening ? (
              <ActivityIndicator color="#000" size="small" />
            ) : (
              <Text style={styles.waveBtnText}>
                {canMessage === 'request' ? '✉️ Message' : '💬 Message'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={styles.profileBtn}
        onPress={() => {
          onClose();
          navigation.navigate('UserProfile', { userId: point.id });
        }}
      >
        <Text style={styles.profileBtnText}>View Profile</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── Generic card (events / listings) ─────────────────────────────────────

type NonUserEntityPoint = EntityPoint & { kind: 'event' | 'listing' };

function GenericCard({
  point,
  onClose,
}: {
  point: NonUserEntityPoint;
  onClose: () => void;
}): React.JSX.Element {
  const title = point.meta.title;
  const subtitle =
    point.kind === 'event'
      ? `Starts: ${new Date(point.meta.startsAt).toLocaleString()}`
      : `$${(point.meta.priceCents / 100).toFixed(2)} ${point.meta.currency}`;

  return (
    <>
      <View style={styles.handle} />
      <View style={styles.header}>
        <View style={styles.titleGroup}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Export ────────────────────────────────────────────────────────────────

export function EntityBottomSheet({ point, waving, onClose, onWave }: Props): React.JSX.Element {
  return (
    <View style={styles.sheet}>
      {point.kind === 'user' ? (
        <UserCard
          point={point as UserEntityPoint}
          waving={waving}
          onClose={onClose}
          onWave={onWave}
        />
      ) : (
        <GenericCard point={point as NonUserEntityPoint} onClose={onClose} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#444',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 4,
  },

  // User card
  userHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  userHeaderText: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  verifiedBadge: {
    backgroundColor: '#00d4ff',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  verifiedText: { color: '#000', fontSize: 11, fontWeight: '700' },
  onlineLabel: { color: '#4caf50', fontSize: 12, marginTop: 2 },
  offlineLabel: { color: '#666' },
  bio: { color: '#ccc', fontSize: 14, lineHeight: 20 },
  goalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0a0a1a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  goalIcon: { fontSize: 13 },
  goalLabel: { color: '#aaa', fontSize: 12 },

  // Actions
  sharedHint: { color: '#7ad7ff', fontSize: 13 },
  actions: { flexDirection: 'row', gap: 10 },
  waveBtn: {
    flex: 1,
    backgroundColor: '#00d4ff',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  messageBtn: {
    flex: 1,
    backgroundColor: '#34e0a1',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  waveBtnText: { color: '#000', fontWeight: '700', fontSize: 15 },
  profileBtn: {
    backgroundColor: '#0a0a1a',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  profileBtnText: { color: '#aaa', fontWeight: '600', fontSize: 15 },
  btnDisabled: { opacity: 0.6 },

  // Generic card
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  titleGroup: { flex: 1 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#aaa', fontSize: 13, marginTop: 2 },
  closeBtn: { padding: 4 },
  closeText: { color: '#aaa', fontSize: 16 },
});
