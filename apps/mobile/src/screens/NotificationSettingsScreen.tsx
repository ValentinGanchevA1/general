// apps/mobile/src/screens/NotificationSettingsScreen.tsx
//
// P3.3 mobile surfacing: per-channel push opt-out toggles, driven by the shared
// NOTIFICATION_CHANNELS list and backed by /notifications/preferences.

import React from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { NOTIFICATION_CHANNELS, NOTIFICATION_CHANNEL_META } from '@g88/shared';
import { useNotificationPreferences } from '@/features/notifications/useNotificationPreferences';

export function NotificationSettingsScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const { prefs, loading, saving, setChannel } = useNotificationPreferences();

  return (
    <ScrollView style={S.container} contentContainerStyle={S.content}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={S.back} hitSlop={8}>
          <Icon name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>
        <Text style={S.headerTitle}>Notifications</Text>
        <View style={S.back} />
      </View>

      <Text style={S.intro}>Choose which push notifications you want to receive.</Text>

      {loading && !prefs ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#00d4ff" />
      ) : !prefs ? (
        <Text style={S.error}>Couldn't load your notification settings.</Text>
      ) : (
        <View style={S.list}>
          {NOTIFICATION_CHANNELS.map((channel) => {
            const meta = NOTIFICATION_CHANNEL_META[channel];
            return (
              <View key={channel} style={S.row}>
                <View style={S.rowContent}>
                  <Text style={S.rowLabel}>{meta.label}</Text>
                  <Text style={S.rowSub}>{meta.description}</Text>
                </View>
                {saving === channel ? (
                  <ActivityIndicator color="#00d4ff" />
                ) : (
                  <Switch
                    value={prefs[channel]}
                    onValueChange={(v) => void setChannel(channel, v)}
                    trackColor={{ false: '#2a2a4a', true: '#0095b3' }}
                    thumbColor={prefs[channel] ? '#00d4ff' : '#555'}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  content: { paddingBottom: 40 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 12, paddingTop: 56,
  },
  back: { width: 40, alignItems: 'flex-start' },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  intro: { color: '#888', fontSize: 14, paddingHorizontal: 20, marginBottom: 16 },
  error: { color: '#ff6b6b', fontSize: 14, textAlign: 'center', marginTop: 40 },
  list: { paddingHorizontal: 16, gap: 10 },
  row: {
    backgroundColor: '#12121f', borderRadius: 12, padding: 16,
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#1f1f33',
  },
  rowContent: { flex: 1, paddingRight: 12 },
  rowLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowSub: { color: '#666', fontSize: 12, marginTop: 2 },
});
