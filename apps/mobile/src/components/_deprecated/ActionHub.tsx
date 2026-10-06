// apps/mobile/src/components/_deprecated/ActionHub.tsx
// Deprecated — superseded by MapFilterRow Create + CreateNearbySheet + ContextualFab (unwired).
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

import { useAppDispatch } from '@/hooks/redux';
import { setPendingFilter } from '@/features/pulse/pulseSlice';
import { colors, fontSize, radius, spacing } from '@/theme';
import { ACTION_HUB_ACTIONS, type ActionHubAction } from './actionHubActions';

export function ActionHub(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  // useNavigation returns Stack nav here (ActionHub is outside Tab.Navigator).
  // Calling navigate('Pulse') propagates the action to the nested Tab navigator.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = useNavigation<any>();
  const dispatch = useAppDispatch();

  const onAction = (a: ActionHubAction): void => {
    setOpen(false);
    dispatch(setPendingFilter(a.filter));
    nav.navigate('Main', { screen: 'Pulse' });
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
        <MCI name="plus" size={28} color={colors.onPrimary} />
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
                  <MCI name={a.icon} size={22} color={colors.primary} />
                </View>
                <Text style={S.actionLabel}>{a.label}</Text>
                <MCI name="chevron-right" size={20} color={colors.textFaint} style={{ marginLeft: 'auto' }} />
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
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: colors.primary, shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
    elevation: 8, zIndex: 100,
  },
  fabPressed:    { opacity: 0.85, transform: [{ scale: 0.95 }] },
  backdrop:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet:         { backgroundColor: colors.surfaceAlt, paddingHorizontal: spacing.md, paddingTop: spacing.sm, paddingBottom: spacing.xl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
  handle:        { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: spacing.sm },
  sheetTitle:    { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: spacing.xs, paddingHorizontal: spacing.xs },
  action:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: spacing.xs, borderRadius: radius.md },
  actionPressed: { backgroundColor: colors.bg },
  actionIcon:    { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', marginRight: spacing.md },
  actionLabel:   { color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '500' },
});
