import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
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
  VerificationLevel,
  WaveRequest,
  WaveResponse,
} from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { deleteJson, getJson, postJson } from '@/api/client';
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';
import { SendGiftSheet } from '@/features/gifts/SendGiftSheet';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Avatar } from '@/components/Avatar';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';

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

export function UserProfileScreen({ route, navigation }: Props): React.JSX.Element {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [waving, setWaving] = useState(false);
  const [giftSheetOpen, setGiftSheetOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);

  const blocked = profile?.blockedByViewer ?? false;

  const loadProfile = useCallback(() => {
    void (async () => {
      try {
        const data = await getJson<PublicUserProfile>(`/users/${userId}`);
        setProfile(data);
      } catch {
        Alert.alert('Error', 'Could not load this profile.', [
          { text: 'Go back', onPress: () => navigation.goBack() },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, navigation]);

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
      const msg =
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as ApiError).message)
          : 'Could not send wave';
      Alert.alert('Wave failed', msg);
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

  const openMenu = (): void => {
    if (blocked) {
      Alert.alert('Unblock?', `Unblock ${profile?.displayName ?? 'this user'}?`, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unblock', onPress: () => void unblock() },
      ]);
      return;
    }
    Alert.alert(profile?.displayName ?? 'Options', undefined, [
      { text: 'Block user', style: 'destructive', onPress: confirmBlock },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00d4ff" size="large" />
      </View>
    );
  }

  if (!profile) return <View style={styles.centered} />;

  const badges = earnedBadges(profile.verification);

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
          </View>
        </View>

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
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>About</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        ) : null}

        {profile.goals.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Goals</Text>
            <View style={styles.goalsRow}>
              {profile.goals.map((g) => {
                const opt = GOAL_OPTIONS.find((o) => o.value === g);
                return (
                  <View key={g} style={styles.goalChip}>
                    <Text style={styles.goalIcon}>{opt?.icon ?? '•'}</Text>
                    <Text style={styles.goalLabel}>{opt?.label ?? g}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        ) : null}

        {(profile.photoUrls?.length ?? 0) > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Photos</Text>
            <View style={styles.photoGrid}>
              {profile.photoUrls!.map((url, index) => (
                <Image key={`${url}-${index}`} source={{ uri: url }} style={styles.gridPhoto} />
              ))}
            </View>
          </View>
        ) : null}

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

const PHOTO = (Dimensions.get('window').width - 48) / 3;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  centered: { flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 52,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backBtn: { padding: 8 },
  backBtnText: { color: '#00d4ff', fontSize: 16, fontWeight: '600' },
  menuBtn: { padding: 8 },
  menuBtnText: { color: '#888', fontSize: 22, letterSpacing: 2 },
  scroll: { padding: 20, gap: 28, paddingBottom: 24 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 8 },
  heroMeta: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  displayName: { color: '#fff', fontSize: 24, fontWeight: '700' },
  originLine: { color: '#888', fontSize: 13, marginTop: 2 },
  onlineLabel: { color: '#4caf50', fontSize: 13 },
  offlineLabel: { color: '#666' },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trustBar: { flex: 1, height: 6, backgroundColor: '#1a1a24', borderRadius: 3, overflow: 'hidden' },
  trustProgress: { height: '100%', backgroundColor: '#00d4ff', borderRadius: 3 },
  trustText: { color: '#888', fontSize: 12 },
  trustBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  trustChip: {
    backgroundColor: '#15151f',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  trustChipText: { color: '#9aa', fontSize: 12, fontWeight: '600' },
  trustChipStrong: { backgroundColor: '#00d4ff20' },
  trustChipStrongText: { color: '#00d4ff', fontSize: 12, fontWeight: '700' },
  trustEmpty: { color: '#666', fontSize: 12 },
  section: { gap: 10 },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  gridPhoto: { width: PHOTO, height: PHOTO, borderRadius: 10, backgroundColor: '#1a1a24' },
  sectionLabel: {
    color: '#555',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  bioText: { color: '#ddd', fontSize: 15, lineHeight: 22 },
  goalsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  goalIcon: { fontSize: 15 },
  goalLabel: { color: '#ccc', fontSize: 13, fontWeight: '500' },
  footer: { flexDirection: 'row', gap: 12, padding: 20, paddingBottom: 36 },
  waveBtn: {
    flex: 1,
    backgroundColor: '#00d4ff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  waveBtnDisabled: { opacity: 0.6 },
  waveBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
  giftBtn: {
    paddingHorizontal: 22,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#00d4ff66',
  },
  giftBtnText: { color: '#00d4ff', fontWeight: '700', fontSize: 16 },
  unblockBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#ff6b6b66',
  },
  unblockBtnText: { color: '#ff6b6b', fontWeight: '700', fontSize: 16 },
});
