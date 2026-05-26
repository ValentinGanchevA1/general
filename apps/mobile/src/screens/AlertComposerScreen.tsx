// apps/mobile/src/screens/AlertComposerScreen.tsx
//
// Placeholder so the ContextualFab + Pulse ShareCTA have a navigation target.
// Real composer lives in P2.5 / X3. When that lands, also flip
// POST_ALERT_READY = true in useFabContext.ts to promote post_alert to primary.

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { RootStackParamList } from '@/navigation/AppNavigator';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<RootStackParamList, 'AlertComposer'>;

export function AlertComposerScreen(): React.JSX.Element {
  const nav = useNavigation<Nav>();
  const route = useRoute<R>();

  return (
    <View style={S.container}>
      <View style={S.header}>
        <TouchableOpacity onPress={() => nav.goBack()} testID="alert-composer-back" hitSlop={8}>
          <MCI name="close" size={26} color="#fff" />
        </TouchableOpacity>
        <Text style={S.title}>Post an alert</Text>
        <View style={{ width: 26 }} />
      </View>

      <View style={S.body}>
        <MCI name="bullhorn-outline" size={56} color="#2a2a4a" />
        <Text style={S.heading}>Coming soon</Text>
        <Text style={S.subheading}>
          Share what's happening in your area — events, alerts, recommendations.
        </Text>

        {route.params?.presetCategory && (
          <Text style={S.preset}>Category preset: {route.params.presetCategory}</Text>
        )}
        {route.params?.presetTag && (
          <Text style={S.preset}>Tag preset: {route.params.presetTag}</Text>
        )}

        <TouchableOpacity style={S.cta} onPress={() => nav.goBack()}>
          <Text style={S.ctaText}>Back to Pulse</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#1a1a2e',
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '600' },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  heading: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 16 },
  subheading: { color: '#aaa', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  preset: { color: '#666', fontSize: 12, marginTop: 4 },
  cta: {
    marginTop: 28, paddingHorizontal: 24, paddingVertical: 12,
    backgroundColor: '#1a1a2e', borderRadius: 12,
    borderWidth: 1, borderColor: '#2a2a4a',
  },
  ctaText: { color: '#00d4ff', fontSize: 14, fontWeight: '600' },
});
