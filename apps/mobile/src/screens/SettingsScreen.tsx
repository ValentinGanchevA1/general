import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { logout } from '@/features/auth/authSlice';
import { updateProfile } from '@/features/profile/profileSlice';

export function SettingsScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const profile = useAppSelector((s) => s.profile.profile);
  const { loading } = useAppSelector((s) => s.profile);

  const [toggling, setToggling] = useState(false);
  const isVisible = profile?.visibility !== 'private';

  const toggleVisibility = async (): Promise<void> => {
    if (toggling || !profile) return;
    setToggling(true);
    try {
      await dispatch(
        updateProfile({ visibility: isVisible ? 'private' : 'public' }),
      );
    } finally {
      setToggling(false);
    }
  };

  const handleLogout = (): void => {
    dispatch(logout());
  };

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.row}>
          <View style={styles.rowContent}>
            <Text style={styles.rowLabel}>Appear on map</Text>
            <Text style={styles.rowSub}>
              {isVisible
                ? 'Others can see you nearby'
                : 'You are hidden from discovery'}
            </Text>
          </View>
          {toggling || loading ? (
            <ActivityIndicator color="#00d4ff" />
          ) : (
            <Switch
              value={isVisible}
              onValueChange={toggleVisibility}
              trackColor={{ false: '#2a2a4a', true: '#0095b3' }}
              thumbColor={isVisible ? '#00d4ff' : '#555'}
            />
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0f', padding: 24 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 24 },
  section: { marginBottom: 32 },
  sectionTitle: {
    color: '#555',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  row: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  rowContent: { flex: 1 },
  rowLabel: { color: '#fff', fontSize: 15, fontWeight: '500' },
  rowSub: { color: '#666', fontSize: 12, marginTop: 2 },
  logoutBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3a1a1a',
  },
  logoutText: { color: '#ff6b6b', fontWeight: '600', fontSize: 15 },
});
