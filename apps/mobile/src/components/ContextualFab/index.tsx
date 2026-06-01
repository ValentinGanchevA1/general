// apps/mobile/src/components/ContextualFab/index.tsx
//
// Contextual speed-dial FAB. Replaces ActionHub on the map surface.
// - Single tap   → primary action (varies by context)
// - Long-press   → expand secondary dial (350ms, haptic)
// - Double-tap   → also expand (a11y alternative)
// - Backdrop tap → collapse

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, StyleSheet, Text, Vibration,
} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { DiscoveryPoint } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useAppDispatch } from '@/hooks/redux';
import { setPendingFilter } from '@/features/pulse/pulseSlice';
import { track } from '@/lib/analytics';

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

const DOUBLE_TAP_MS = 250;
const LONG_PRESS_MS = 350;
const STAGGER = [40, 92, 144];

export function ContextualFab(props: Props): React.JSX.Element {
  const { zoom, points, nearestUserId, onAction } = props;
  const ctx = useFabContext({ zoom, points, nearestUserId });

  const [open, setOpen] = useState(false);
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const dispatch = useAppDispatch();

  const anim = useRef(new Animated.Value(0)).current;
  const lastTapAt = useRef(0);
  const expandStartAt = useRef(0);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimerRef.current !== null) clearTimeout(tapTimerRef.current);
    };
  }, []);

  const animateTo = useCallback((toValue: number): void => {
    Animated.spring(anim, {
      toValue, useNativeDriver: true, friction: 7, tension: 80,
    }).start();
  }, [anim]);

  const expand = useCallback((gesture: 'long' | 'double'): void => {
    if (open) return;
    setOpen(true);
    expandStartAt.current = Date.now();
    animateTo(1);
    try { Vibration.vibrate(10); } catch { /* no-op on web/sim */ }
    track('fab.expand', {
      contextKey: ctx.key,
      primaryActionId: ctx.primary,
      gesture,
    });
  }, [open, animateTo, ctx]);

  const collapse = useCallback((): void => {
    animateTo(0);
    setOpen(false);
  }, [animateTo]);

  const runAction = useCallback(async (id: FabActionId, surface: 'primary' | 'secondary'): Promise<void> => {
    const dwellMs = surface === 'secondary' ? Date.now() - expandStartAt.current : 0;
    track(surface === 'primary' ? 'fab.tap.primary' : 'fab.tap.secondary', {
      contextKey: ctx.key,
      primaryActionId: ctx.primary,
      secondaryActionId: surface === 'secondary' ? id : null,
      dwellMs,
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
        // No dedicated screen yet — Pulse with listings filter until trading UI ships.
        dispatch(setPendingFilter('listings'));
        nav.navigate('Main', { screen: 'Pulse' });
        break;
      case 'toggle_visibility':
        nav.navigate('Settings');
        break;
      default:
        // wave_nearest should be intercepted by host; fall through safely
        dispatch(setPendingFilter('all'));
        nav.navigate('Main', { screen: 'Pulse' });
    }
    collapse();
  }, [ctx, onAction, dispatch, nav, collapse]);

  // Tap handling: distinguish single-tap (run primary after grace) from
  // double-tap (expand). Long-press is independent via Pressable.
  const onTap = useCallback((): void => {
    const now = Date.now();
    if (now - lastTapAt.current <= DOUBLE_TAP_MS) {
      lastTapAt.current = 0;
      expand('double');
      return;
    }
    lastTapAt.current = now;
    tapTimerRef.current = setTimeout(() => {
      if (lastTapAt.current && Date.now() - lastTapAt.current >= DOUBLE_TAP_MS) {
        void runAction(ctx.primary, 'primary');
        lastTapAt.current = 0;
      }
    }, DOUBLE_TAP_MS + 10);
  }, [ctx.primary, runAction, expand]);

  const primaryDef = FAB_ACTIONS[ctx.primary];

  return (
    <>
      <Pressable
        style={({ pressed }) => [S.fab, pressed && S.fabPressed]}
        onPress={onTap}
        onLongPress={() => expand('long')}
        delayLongPress={LONG_PRESS_MS}
        testID="contextual-fab"
        accessibilityRole="button"
        accessibilityLabel={`Primary action: ${primaryDef.label}. Long-press for more options.`}
        hitSlop={8}
      >
        <MCI name={primaryDef.primaryGlyph} size={28} color="#0a0a0f" />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={collapse}
      >
        <Pressable style={S.backdrop} onPress={collapse} testID="fab-backdrop">
          {ctx.secondary.map((id, i) => {
            const def = FAB_ACTIONS[id];
            const translateY = anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -(STAGGER[i] ?? 40)],
            });
            const opacity = anim.interpolate({
              inputRange: [0, 1], outputRange: [0, 1],
            });
            return (
              <Animated.View
                key={id}
                style={[S.secondaryWrap, { transform: [{ translateY }], opacity }]}
                pointerEvents="box-none"
              >
                <Text style={S.secondaryLabel}>{def.label}</Text>
                <Pressable
                  testID={`fab-secondary-${id}`}
                  style={S.secondary}
                  onPress={() => { void runAction(id, 'secondary'); }}
                >
                  <MCI name={def.icon} size={20} color="#00d4ff" />
                </Pressable>
              </Animated.View>
            );
          })}
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
    shadowColor: '#00d4ff', shadowOpacity: 0.5, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 8, zIndex: 100,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.95 }] },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },

  secondaryWrap: {
    position: 'absolute', bottom: 90, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  secondary: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1a1a2e',
    borderWidth: 1, borderColor: '#2a2a4a',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, elevation: 6,
  },
  secondaryLabel: {
    color: '#fff', fontSize: 13, fontWeight: '500',
    backgroundColor: 'rgba(26,26,46,0.9)',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10, overflow: 'hidden',
  },
});
