// apps/mobile/src/components/ContextualFab/index.tsx
//
// Stable speed-dial FAB (Phase-1 UX pass).
// - Fixed identity: a "Create" button, bottom-right, with an always-visible
//   label pill. The button never changes meaning — it always opens the menu.
// - Single tap → toggle the actions menu. No long-press, no double-tap, no
//   tap-disambiguation delay (the old morphing-primary model made the button
//   unpredictable and every tap felt laggy).
// - Context (zoom/density/visibility/goal) is used ONLY to order the menu, so
//   the most relevant action sits at the top — it no longer swaps what a tap
//   does.
// - Backdrop tap → collapse. Lightweight in-tree overlay (no full-screen Modal,
//   so the map stays visible behind a light scrim).

import React, { useCallback, useState } from 'react';
import {
  Animated, Pressable, StyleSheet, Text, Vibration, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { DiscoveryPoint } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch } from '@/hooks/redux';
import { setPendingFilter } from '@/features/pulse/pulseSlice';
import { track } from '@/lib/analytics';
import { colors, radius, spacing, fontSize, shadow } from '@/theme';

import { useFabContext, type FabActionId } from './useFabContext';
import { FAB_ACTIONS } from './fabActions';

interface Props {
  zoom: number;
  points: DiscoveryPoint[];
  nearestUserId: string | null;
  /**
   * Host (MapScreen) can intercept specific actions for optimistic UX
   * (e.g. wave_nearest). Returning truthy means handled; falsy = fall
   * through to default routing.
   */
  onAction?: (id: FabActionId, ctxKey: string) => boolean | Promise<boolean>;
}

const FAB_SIZE = 56;
const ITEM_SIZE = 48;
const ITEM_GAP = 14;
const FAB_BOTTOM = spacing.xxl; // 24 — clears the bottom tab bar (screen content sits above it)

export function ContextualFab(props: Props): React.JSX.Element {
  const { zoom, points, nearestUserId, onAction } = props;
  const ctx = useFabContext({ zoom, points, nearestUserId });

  const [open, setOpen] = useState(false);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();

  // useState (not useRef) so identity is stable without a render-time ref read.
  const [anim] = useState(() => new Animated.Value(0));
  const [expandAt, setExpandAt] = useState(0);

  const animateTo = useCallback((toValue: number): void => {
    Animated.spring(anim, {
      toValue, useNativeDriver: true, friction: 7, tension: 80,
    }).start();
  }, [anim]);

  const collapse = useCallback((): void => {
    animateTo(0);
    setOpen(false);
  }, [animateTo]);

  const toggle = useCallback((): void => {
    if (open) { collapse(); return; }
    setOpen(true);
    setExpandAt(Date.now());
    animateTo(1);
    try { Vibration.vibrate(10); } catch { /* no-op on web/sim */ }
    track('fab.expand', { contextKey: ctx.key, primaryActionId: ctx.primary, gesture: 'tap' });
  }, [open, collapse, animateTo, ctx.key, ctx.primary]);

  const runAction = useCallback(async (id: FabActionId): Promise<void> => {
    const isPrimary = id === ctx.primary;
    track(isPrimary ? 'fab.tap.primary' : 'fab.tap.secondary', {
      contextKey: ctx.key,
      primaryActionId: ctx.primary,
      secondaryActionId: isPrimary ? null : id,
      dwellMs: Date.now() - expandAt,
    });

    if (onAction) {
      const handled = await onAction(id, ctx.key);
      if (handled) { collapse(); return; }
    }

    // Default routing — host did not intercept.
    switch (id) {
      case 'open_pulse':
        dispatch(setPendingFilter('all'));
        nav.navigate('Main', { screen: 'Pulse' });
        break;
      case 'post_alert':
        nav.navigate('AlertComposer', { presetCategory: 'general' });
        break;
      case 'create_listing':
        dispatch(setPendingFilter('listings'));
        nav.navigate('Main', { screen: 'Pulse' });
        break;
      case 'toggle_visibility':
        nav.navigate('Settings');
        break;
      default:
        // wave_nearest should be intercepted by host; fall through safely.
        dispatch(setPendingFilter('all'));
        nav.navigate('Main', { screen: 'Pulse' });
    }
    collapse();
  }, [ctx.key, ctx.primary, expandAt, onAction, dispatch, nav, collapse]);

  // Context decides ORDER only: most relevant first, then ranked secondaries.
  const menu: FabActionId[] = [ctx.primary, ...ctx.secondary];

  return (
    <>
      {open && (
        <Pressable style={S.backdrop} onPress={collapse} testID="fab-backdrop" />
      )}

      {open && menu.map((id, i) => {
        const def = FAB_ACTIONS[id];
        const bottom = FAB_BOTTOM + insets.bottom + FAB_SIZE + ITEM_GAP + i * (ITEM_SIZE + ITEM_GAP);
        const opacity = anim;
        const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] });
        return (
          <Animated.View
            key={id}
            style={[S.itemRow, { bottom, opacity, transform: [{ translateY }] }]}
            pointerEvents="box-none"
          >
            <Text style={S.itemLabel}>{def.label}</Text>
            <Pressable
              testID={`fab-secondary-${id}`}
              style={S.item}
              onPress={() => { void runAction(id); }}
              accessibilityRole="button"
              accessibilityLabel={def.label}
            >
              <MCI name={def.icon} size={20} color={colors.primary} />
            </Pressable>
          </Animated.View>
        );
      })}

      <Pressable
        style={({ pressed }) => [S.fabRow, { bottom: FAB_BOTTOM + insets.bottom }, pressed && S.pressed]}
        onPress={toggle}
        testID="contextual-fab"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Close actions menu' : 'Create. Opens the actions menu.'}
        hitSlop={8}
      >
        <Text style={S.fabLabel}>{open ? 'Close' : 'Create'}</Text>
        <View style={S.fab}>
          <MCI name={open ? 'close' : 'plus'} size={28} color={colors.onPrimary} />
        </View>
      </Pressable>
    </>
  );
}

const S = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    zIndex: 90,
  },

  fabRow: {
    position: 'absolute', right: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    zIndex: 102,
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.97 }] },
  fab: {
    width: FAB_SIZE, height: FAB_SIZE, borderRadius: radius.fab,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    ...shadow.fab,
  },
  fabLabel: {
    color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '700',
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: radius.pill, overflow: 'hidden',
  },

  itemRow: {
    position: 'absolute', right: spacing.lg,
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    zIndex: 101,
  },
  item: {
    width: ITEM_SIZE, height: ITEM_SIZE, borderRadius: ITEM_SIZE / 2,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1, borderColor: colors.borderStrong,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 6,
  },
  itemLabel: {
    color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '500',
    backgroundColor: 'rgba(26,26,46,0.9)',
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    borderRadius: radius.md, overflow: 'hidden',
  },
});
