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
  View,
} from 'react-native';

import { NOTIFICATION_CHANNELS, NOTIFICATION_CHANNEL_META } from '@g88/shared';
import { useNotificationPreferences } from '@/features/notifications/useNotificationPreferences';
import { ScreenHeader } from '@/components/ScreenHeader';

export function NotificationSettingsScreen(): React.JSX.Element {
  const { prefs, loading, saving, setChannel } = useNotificationPreferences();

  return (
    <View style={S.container}>
      <ScreenHeader title="Notifications" />

      <ScrollView style={S.flex} contentContainerStyle={S.content}>
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
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  flex: { flex: 1 },
  content: { paddingBottom: 40 },
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
