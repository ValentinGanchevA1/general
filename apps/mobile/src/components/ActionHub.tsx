// apps/mobile/src/components/ActionHub.tsx
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { RootStackParamList } from '@/navigation/AppNavigator';
import { ACTION_HUB_ACTIONS, type ActionHubAction } from './actionHubActions';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ActionHub(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const nav = useNavigation<Nav>();

  const onAction = (a: ActionHubAction): void => {
    setOpen(false);
    nav.navigate('Main', { screen: 'Pulse', params: { filter: a.filter } });
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [S.fab, pressed && S.fabPressed]}
        onPress={() => setOpen(true)}
        testID="action-hub-fab"
        accessibilityRole="button"
        accessibilityLabel="Quick actions"
        hitSlop={8}
      >
        <MCI name="plus" size={28} color="#0a0a0f" />
      </Pressable>

      <Modal
        visible={open} transparent animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={S.backdrop}
          onPress={() => setOpen(false)}
          testID="action-hub-backdrop"
        >
          <View style={S.sheet} onStartShouldSetResponder={() => true}>
            <View style={S.handle} />
            <Text style={S.sheetTitle}>Quick actions</Text>
            {ACTION_HUB_ACTIONS.map((a) => (
              <Pressable
                key={a.key}
                style={({ pressed }) => [S.action, pressed && S.actionPressed]}
                testID={`action-${a.key}`}
                onPress={() => onAction(a)}
              >
                <View style={S.actionIcon}>
                  <MCI name={a.icon} size={22} color="#00d4ff" />
                </View>
                <Text style={S.actionLabel}>{a.label}</Text>
                <MCI name="chevron-right" size={20} color="#555" style={{ marginLeft: 'auto' }} />
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const S = StyleSheet.create({
  fab: {
    position: 'absolute', bottom: 90, alignSelf: 'center',
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: '#00d4ff', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#00d4ff', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8, zIndex: 100,
  },
  fabPressed:    { opacity: 0.85, transform: [{ scale: 0.95 }] },
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: '#1a1a2e', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  handle:        { width: 36, height: 4, borderRadius: 2, backgroundColor: '#2a2a4a', alignSelf: 'center', marginBottom: 12 },
  sheetTitle:    { color: '#aaa', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  action:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 8, borderRadius: 12 },
  actionPressed: { backgroundColor: '#0a0a0f' },
  actionIcon:    { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a0a0f', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  actionLabel:   { color: '#fff', fontSize: 16, fontWeight: '500' },
});
