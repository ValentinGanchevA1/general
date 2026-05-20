import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppSelector } from '@/hooks/redux';

type Nav = NativeStackNavigationProp<RootStackParamList>;

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
  const navigation = useNavigation<Nav>();
  const profile = useAppSelector((s) => s.profile.profile);

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
