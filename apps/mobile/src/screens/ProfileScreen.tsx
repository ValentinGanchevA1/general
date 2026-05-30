import React, { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { useGamification } from '@/features/gamification/useGamification';
import type { GamificationSummary } from '@g88/shared';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function ProgressCard({ summary }: { summary: GamificationSummary }): React.JSX.Element {
  const pct = summary.xpForNextLevel > 0
    ? Math.min(100, Math.round((summary.xpIntoLevel / summary.xpForNextLevel) * 100))
    : 0;
  return (
    <View style={styles.progressCard}>
      <View style={styles.progressRow}>
        <Text style={styles.levelText}>Level {summary.level}</Text>
        <Text style={styles.xpText}>{summary.totalXp.toLocaleString()} XP</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%` }]} />
      </View>
      <View style={styles.progressRow}>
        <Text style={styles.subText}>
          {summary.xpIntoLevel}/{summary.xpForNextLevel} to Lvl {summary.level + 1}
        </Text>
        {summary.currentStreak > 0 ? (
          <Text style={styles.streakText}>🔥 {summary.currentStreak}-day streak</Text>
        ) : null}
      </View>
    </View>
  );
}

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

export function ProfileScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const { profile, loading } = useAppSelector((s) => s.profile);
  const { summary: gamification, refresh: refreshGamification } = useGamification();

  useFocusEffect(useCallback(() => {
    void dispatch(fetchProfile());
    refreshGamification();
  }, [dispatch, refreshGamification]));

  if (loading && !profile) {
    return <View style={styles.root}><ActivityIndicator style={{ flex: 1 }} color="#00d4ff" /></View>;
  }
  if (!profile) return <View style={styles.root} />;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <InitialsAvatar name={profile.displayName} />
        <Text style={styles.name}>{profile.displayName}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {profile.visibility === 'private' ? 'Invisible' : 'Visible on map'}
          </Text>
        </View>
      </View>

      {gamification ? <ProgressCard summary={gamification} /> : null}

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => navigation.navigate('ProfileEdit')}
        >
          <Text style={styles.actionText}>Edit Profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.actionTextSecondary}>Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f' },
  header: { alignItems: 'center', padding: 32, gap: 8 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#1a1a2e',
    borderWidth: 2,
    borderColor: '#00d4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  avatarText: { color: '#00d4ff', fontSize: 30, fontWeight: '700' },
  name: { color: '#fff', fontSize: 22, fontWeight: '700' },
  bio: { color: '#aaa', fontSize: 14, textAlign: 'center', maxWidth: 280 },
  badge: {
    backgroundColor: '#1a1a2e',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 12,
    marginTop: 4,
  },
  badgeText: { color: '#00d4ff', fontSize: 12, fontWeight: '600' },
  progressCard: {
    marginHorizontal: 24,
    backgroundColor: '#12121f',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1f1f33',
    gap: 8,
  },
  progressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  xpText: { color: '#00d4ff', fontSize: 14, fontWeight: '600' },
  barTrack: { height: 8, backgroundColor: '#1f1f33', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: 8, backgroundColor: '#00d4ff', borderRadius: 4 },
  subText: { color: '#888', fontSize: 12 },
  streakText: { color: '#ff9d3c', fontSize: 12, fontWeight: '600' },
  actions: { padding: 24, gap: 12 },
  actionBtn: {
    backgroundColor: '#00d4ff',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  actionBtnSecondary: { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a' },
  actionText: { color: '#000', fontWeight: '700', fontSize: 15 },
  actionTextSecondary: { color: '#aaa', fontWeight: '600', fontSize: 15 },
});
