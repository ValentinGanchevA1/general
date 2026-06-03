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
import type { ApiError, PublicUserProfile, WaveRequest, WaveResponse } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { getJson, postJson } from '@/api/client';
import { GOAL_OPTIONS } from '@/features/profile/goalOptions';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

function InitialsAvatar({ name }: { name: string }): React.JSX.Element {
  const initials = name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

export function UserProfileScreen({ route, navigation }: Props): React.JSX.Element {
  const { userId } = route.params;
  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [waving, setWaving] = useState(false);

  const loadProfile = useCallback(async () => {
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
  }, [userId, navigation]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  const sendWave = async (): Promise<void> => {
    setWaving(true);
    try {
      await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
        toUserId: userId,
        context: 'profile',
      });
      Alert.alert('Wave sent! 👋', `You waved at ${profile?.displayName ?? 'this user'}.`);
    } catch (err) {
      const e = err as ApiError;
      Alert.alert(
        e.code === 'wave.cooldown' ? 'Already waved' : 'Could not send wave',
        e.message || 'Try again in a moment.',
      );
    } finally {
      setWaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#00d4ff" size="large" />
      </View>
    );
  }

  if (!profile) return <View style={styles.centered} />;

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <InitialsAvatar name={profile.displayName} />
          <View style={styles.heroMeta}>
            <View style={styles.nameRow}>
              <Text style={styles.displayName}>{profile.displayName}</Text>
              {profile.verification !== 'none' && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedText}>✓</Text>
                </View>
              )}
            </View>
            <Text style={[styles.onlineLabel, !profile.online && styles.offlineLabel]}>
              {profile.online ? 'Online now' : 'Recently nearby'}
            </Text>
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
            <Text style={styles.sectionLabel}>Here for</Text>
            <View style={styles.goalsRow}>
              {profile.goals.map((g) => {
                const opt = GOAL_OPTIONS.find((o) => o.value === g);
                return opt ? (
                  <View key={g} style={styles.goalChip}>
                    <Text style={styles.goalIcon}>{opt.icon}</Text>
                    <Text style={styles.goalLabel}>{opt.label}</Text>
                  </View>
                ) : null;
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.waveBtn, waving && styles.waveBtnDisabled]}
          onPress={sendWave}
          disabled={waving}
        >
          {waving ? (
            <ActivityIndicator color="#000" size="small" />
          ) : (
            <Text style={styles.waveBtnText}>👋 Send Wave</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  centered: { flex: 1, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center' },

  topBar: { paddingTop: 52, paddingHorizontal: 20, paddingBottom: 8 },
  backBtn: { alignSelf: 'flex-start' },
  backBtnText: { color: '#00d4ff', fontSize: 17, fontWeight: '600' },

  scroll: { paddingHorizontal: 24, paddingBottom: 24, gap: 24 },

  heroSection: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#00d4ff', fontSize: 28, fontWeight: '700' },
  heroMeta: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  displayName: { color: '#fff', fontSize: 24, fontWeight: '700' },
  verifiedBadge: {
    backgroundColor: '#00d4ff',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verifiedText: { color: '#000', fontSize: 11, fontWeight: '700' },
  onlineLabel: { color: '#4caf50', fontSize: 13 },
  offlineLabel: { color: '#666' },

  section: { gap: 10 },
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

  footer: { padding: 20, paddingBottom: 36 },
  waveBtn: {
    backgroundColor: '#00d4ff',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
  },
  waveBtnDisabled: { opacity: 0.6 },
  waveBtnText: { color: '#000', fontWeight: '700', fontSize: 16 },
});
