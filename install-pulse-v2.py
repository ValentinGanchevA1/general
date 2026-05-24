#!/usr/bin/env python3
"""Install Pulse v2: ContextualFab + Pulse screen refactor (Nextdoor-style).

Decisions baked in:
  C3: post_alert primary deferred — POST_ALERT_READY=false flag in useFabContext.
      Flip to true when AlertComposerScreen becomes real (P2.5 / X3).
  T1: TrendingStrip ON with mock topics (visible per Q4). TODO(X4) marks the swap.
  Q2: Viewport H3 density only. Geofence/POI deferred to v1.5.

Idempotent. Each surgical edit verifies its anchor exists exactly once.
Re-running after a successful install prints `!` warnings (already applied)
and exits clean.

Usage:
  python install-pulse-v2.py [--dry-run]

Run from the g88 repo root (e.g. C:\\Users\\vganc\\g88).
"""
from __future__ import annotations
import shutil
import sys
from pathlib import Path

ROOT = Path.cwd()
DRY = "--dry-run" in sys.argv

# ─── Sanity guard ───────────────────────────────────────────────────────────

if not (ROOT / "pnpm-workspace.yaml").exists():
    print(f"FATAL: pnpm-workspace.yaml not found in {ROOT}")
    print("Run this script from the g88 repo root (e.g. C:\\Users\\vganc\\g88).")
    sys.exit(1)


# ─── New / replacement files (always overwrite) ─────────────────────────────

FILES: dict[str, str] = {

    # 1. Analytics shim --------------------------------------------------------
    "apps/mobile/src/lib/analytics.ts": r"""// apps/mobile/src/lib/analytics.ts
//
// Single entry point for client-side analytics. Swap impl when OB1 (Sentry)
// lands — call sites stay stable.

export type AnalyticsProps = Record<string, string | number | boolean | null>;

export function track(event: string, props: AnalyticsProps = {}): void {
  // eslint-disable-next-line no-console
  console.log(`[analytics] ${event}`, props);
  // TODO(OB1): Sentry.addBreadcrumb({ category: 'analytics', message: event, data: props });
}
""",

    # 2. FAB context engine ---------------------------------------------------
    "apps/mobile/src/components/ContextualFab/useFabContext.ts": r"""// apps/mobile/src/components/ContextualFab/useFabContext.ts
//
// Pure context computation for the Contextual FAB.
// Inputs: viewport zoom, viewport entities, my visibility + primary goal.
// Output: a stable context key + primary action + ranked secondaries.

import { useEffect, useMemo, useRef } from 'react';
import type { DiscoveryPoint } from '@g88/shared';
import { ENTITY_ZOOM_THRESHOLD } from '@g88/shared';

import { useAppSelector } from '@/hooks/redux';
import { track } from '@/lib/analytics';

export type ZoomBand = 'far' | 'mid' | 'near';
export type Density = 0 | 1 | 2 | 3;
export type Visibility = 'on' | 'off';

export type FabActionId =
  | 'wave_nearest'
  | 'post_alert'
  | 'create_listing'
  | 'toggle_visibility'
  | 'open_pulse';

export interface FabContext {
  key: string;
  zoomBand: ZoomBand;
  density: Density;
  visibility: Visibility;
  goalsPrimary: string;
  primary: FabActionId;
  secondary: FabActionId[];
  nearestUserId: string | null;
}

const ALL_ACTIONS: FabActionId[] = [
  'wave_nearest', 'post_alert', 'create_listing', 'toggle_visibility', 'open_pulse',
];

// ─── C3 flag ──────────────────────────────────────────────────────────────
// When AlertComposerScreen ships real impl (P2.5 / X3), flip to `true` and
// the FAB's default-case primary becomes `post_alert` per the user's Q1 pick.
// Until then the FAB falls back to `open_pulse` so the primary tap never
// lands on a "Coming soon" stub.
export const POST_ALERT_READY = false;

function bandForZoom(z: number): ZoomBand {
  if (z >= ENTITY_ZOOM_THRESHOLD) return 'near';
  if (z >= 11) return 'mid';
  return 'far';
}

function densityFor(points: DiscoveryPoint[]): Density {
  const n = points.length;
  if (n === 0) return 0;
  if (n < 5) return 1;
  if (n < 20) return 2;
  return 3;
}

function pickPrimary(
  zoomBand: ZoomBand,
  density: Density,
  visibility: Visibility,
  goal: string,
): FabActionId {
  if (visibility === 'off') return 'toggle_visibility';
  if (zoomBand === 'near' && density >= 1) return 'wave_nearest';
  if (zoomBand !== 'far' && goal === 'trading') return 'create_listing';
  return POST_ALERT_READY ? 'post_alert' : 'open_pulse';
}

function secondaryRanked(primary: FabActionId, zoomBand: ZoomBand): FabActionId[] {
  const rest = ALL_ACTIONS.filter((a) => a !== primary);
  const score = (a: FabActionId): number => {
    if (a === 'open_pulse' && zoomBand === 'far') return 10;
    if (a === 'wave_nearest' && zoomBand !== 'near') return 0;
    if (a === 'create_listing' && zoomBand === 'far') return 1;
    if (a === 'post_alert' && zoomBand === 'far') return 2;
    return 5;
  };
  return rest.sort((a, b) => score(b) - score(a)).slice(0, 3);
}

interface UseFabContextArgs {
  zoom: number;
  points: DiscoveryPoint[];
  nearestUserId: string | null;
}

export function useFabContext(args: UseFabContextArgs): FabContext {
  const isVisible = useAppSelector(
    (s) => s.auth.user?.profile?.isVisible ?? true,
  );
  const goalsPrimary = useAppSelector(
    (s) => s.auth.user?.profile?.goals?.[0] ?? 'dating',
  );

  const ctx = useMemo<FabContext>(() => {
    const zoomBand = bandForZoom(args.zoom);
    const density = densityFor(args.points);
    const visibility: Visibility = isVisible ? 'on' : 'off';
    const primary = pickPrimary(zoomBand, density, visibility, goalsPrimary);
    const secondary = secondaryRanked(primary, zoomBand);
    const key = `z:${zoomBand}|d:${density}|v:${visibility}|g:${goalsPrimary}`;
    return {
      key,
      zoomBand,
      density,
      visibility,
      goalsPrimary,
      primary,
      secondary,
      nearestUserId: args.nearestUserId,
    };
  }, [args.zoom, args.points, args.nearestUserId, isVisible, goalsPrimary]);

  // Emit only when the key flips. Cheap dedupe; no setInterval, no race.
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    if (lastKey.current === ctx.key) return;
    lastKey.current = ctx.key;
    track('fab.context.computed', {
      contextKey: ctx.key,
      zoomBand: ctx.zoomBand,
      density: ctx.density,
      visibility: ctx.visibility,
      goalsPrimary: ctx.goalsPrimary,
      primaryActionId: ctx.primary,
    });
  }, [ctx]);

  return ctx;
}
""",

    # 3. FAB action registry --------------------------------------------------
    "apps/mobile/src/components/ContextualFab/fabActions.ts": r"""// apps/mobile/src/components/ContextualFab/fabActions.ts
import type { FabActionId } from './useFabContext';

export interface FabActionDef {
  id: FabActionId;
  icon: string;           // MaterialCommunityIcons name (secondary button)
  label: string;          // Shown next to secondary button when expanded
  primaryGlyph: string;   // MCI icon name used when this action is primary
}

export const FAB_ACTIONS: Record<FabActionId, FabActionDef> = {
  wave_nearest: {
    id: 'wave_nearest',
    icon: 'hand-wave',
    label: 'Wave nearby',
    primaryGlyph: 'hand-wave',
  },
  post_alert: {
    id: 'post_alert',
    icon: 'bullhorn',
    label: 'Post alert',
    primaryGlyph: 'bullhorn',
  },
  create_listing: {
    id: 'create_listing',
    icon: 'tag-plus',
    label: 'List item',
    primaryGlyph: 'tag-plus',
  },
  toggle_visibility: {
    id: 'toggle_visibility',
    icon: 'eye-off',
    label: 'Become visible',
    primaryGlyph: 'eye-off',
  },
  open_pulse: {
    id: 'open_pulse',
    icon: 'pulse',
    label: 'See activity',
    primaryGlyph: 'plus',
  },
};
""",

    # 4. FAB component --------------------------------------------------------
    "apps/mobile/src/components/ContextualFab/index.tsx": r"""// apps/mobile/src/components/ContextualFab/index.tsx
//
// Contextual speed-dial FAB. Replaces ActionHub on the map surface.
// - Single tap   → primary action (varies by context)
// - Long-press   → expand secondary dial (350ms, haptic)
// - Double-tap   → also expand (a11y alternative)
// - Backdrop tap → collapse

import React, { useCallback, useRef, useState } from 'react';
import {
  Animated, Modal, Pressable, StyleSheet, Text, Vibration, View,
} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';

import type { DiscoveryPoint } from '@g88/shared';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = useNavigation<any>();
  const dispatch = useAppDispatch();

  const anim = useRef(new Animated.Value(0)).current;
  const lastTapAt = useRef(0);
  const expandStartAt = useRef(0);

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
    setTimeout(() => {
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
""",

    # 5. FAB context test -----------------------------------------------------
    "apps/mobile/src/components/ContextualFab/__tests__/useFabContext.spec.ts": r"""// apps/mobile/src/components/ContextualFab/__tests__/useFabContext.spec.ts
import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';

import { useFabContext, POST_ALERT_READY } from '../useFabContext';

interface ProfileShape { isVisible: boolean; goals: string[] }
const authReducer = (profile: ProfileShape) => () => ({ user: { profile } });

const makeStore = (isVisible: boolean, goal = 'dating') =>
  configureStore({ reducer: { auth: authReducer({ isVisible, goals: [goal] }) } });

const wrap = (store: ReturnType<typeof makeStore>) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { store } as any, children);
};

describe('useFabContext', () => {
  it('promotes toggle_visibility when invisible (regardless of zoom)', () => {
    const { result } = renderHook(
      () => useFabContext({ zoom: 18, points: [], nearestUserId: null }),
      { wrapper: wrap(makeStore(false)) },
    );
    expect(result.current.primary).toBe('toggle_visibility');
    expect(result.current.visibility).toBe('off');
  });

  it('picks wave_nearest at near zoom when people are present', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const points = [{ kind: 'user', id: 'u1', lat: 0, lng: 0, meta: {} }] as any;
    const { result } = renderHook(
      () => useFabContext({ zoom: 16, points, nearestUserId: 'u1' }),
      { wrapper: wrap(makeStore(true)) },
    );
    expect(result.current.primary).toBe('wave_nearest');
    expect(result.current.zoomBand).toBe('near');
    expect(result.current.density).toBeGreaterThan(0);
  });

  it('falls back to open_pulse while POST_ALERT_READY=false (C3 flag)', () => {
    const { result } = renderHook(
      () => useFabContext({ zoom: 8, points: [], nearestUserId: null }),
      { wrapper: wrap(makeStore(true)) },
    );
    const expected = POST_ALERT_READY ? 'post_alert' : 'open_pulse';
    expect(result.current.primary).toBe(expected);
    if (!POST_ALERT_READY) {
      expect(result.current.secondary).toContain('post_alert');
    }
  });

  it('routes trading users to create_listing at mid zoom', () => {
    const { result } = renderHook(
      () => useFabContext({ zoom: 13, points: [], nearestUserId: null }),
      { wrapper: wrap(makeStore(true, 'trading')) },
    );
    expect(result.current.primary).toBe('create_listing');
  });

  it('emits a stable context key', () => {
    const { result } = renderHook(
      () => useFabContext({ zoom: 16, points: [], nearestUserId: null }),
      { wrapper: wrap(makeStore(true, 'dating')) },
    );
    expect(result.current.key).toBe('z:near|d:0|v:on|g:dating');
  });
});
""",

    # 6. AlertComposer stub ---------------------------------------------------
    "apps/mobile/src/screens/AlertComposerScreen.tsx": r"""// apps/mobile/src/screens/AlertComposerScreen.tsx
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
""",

    # 7. Pulse — ShareCTA -----------------------------------------------------
    "apps/mobile/src/features/pulse/components/ShareCTA.tsx": r"""// apps/mobile/src/features/pulse/components/ShareCTA.tsx
import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';

interface Props { onPress: () => void }

export function ShareCTA({ onPress }: Props): React.JSX.Element {
  return (
    <Pressable
      style={({ pressed }) => [S.cta, pressed && S.ctaPressed]}
      onPress={onPress}
      testID="share-cta"
      accessibilityRole="button"
      accessibilityLabel="Post an alert about what's happening around you"
    >
      <MCI name="map-marker-radius" size={20} color="#0a0a0f" style={{ marginRight: 10 }} />
      <Text style={S.text}>Share what's happening around you</Text>
      <MCI name="chevron-right" size={20} color="#0a0a0f" style={{ marginLeft: 'auto' }} />
    </Pressable>
  );
}

const S = StyleSheet.create({
  cta: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#00d4ff', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 16,
    marginHorizontal: 12, marginTop: 4, marginBottom: 12,
    shadowColor: '#00d4ff', shadowOpacity: 0.4, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
  },
  ctaPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  text: { color: '#0a0a0f', fontSize: 15, fontWeight: '700', flexShrink: 1 },
});
""",

    # 8. Pulse — ActivityCard -------------------------------------------------
    "apps/mobile/src/features/pulse/components/ActivityCard.tsx": r"""// apps/mobile/src/features/pulse/components/ActivityCard.tsx
//
// Single row in the Pulse feed — Nextdoor-style card with type-coloured left
// border, avatar, timestamp, distance pill, title + preview.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ActivityItem, ActivityType } from '@g88/shared';

const BORDER_BY_TYPE: Record<ActivityType, string> = {
  chat:    '#00d4ff',
  wave:    '#FF69B4',
  listing: '#4CAF50',
  alert:   '#FF9800',
  match:   '#FF69B4',
};

const ICON_BY_TYPE: Record<ActivityType, string> = {
  chat:    'message-text',
  wave:    'hand-wave',
  listing: 'tag',
  alert:   'bullhorn',
  match:   'heart',
};

interface Props {
  item: ActivityItem;
  onPress: () => void;
}

export function ActivityCard({ item, onPress }: Props): React.JSX.Element {
  const initials = (item.actorName ?? '?')
    .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  const distance = item.distanceM != null ? formatDistance(item.distanceM) : null;

  return (
    <Pressable
      style={({ pressed }) => [
        S.card,
        { borderLeftColor: BORDER_BY_TYPE[item.type] },
        pressed && S.cardPressed,
      ]}
      onPress={onPress}
      testID={`activity-card-${item.id}`}
    >
      <View style={S.header}>
        {item.unread && <View style={S.unreadDot} />}
        <View style={S.avatar}>
          <Text style={S.avatarText}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[S.author, item.unread && S.authorUnread]}
            numberOfLines={1}
          >
            {item.actorName ?? 'Someone'}
          </Text>
          <View style={S.meta}>
            <Text style={S.metaText}>{relTime(item.createdAt)}</Text>
            {distance && (
              <View style={S.distancePill}>
                <Text style={S.distanceText}>{distance}</Text>
              </View>
            )}
          </View>
        </View>
        <MCI name={ICON_BY_TYPE[item.type]} size={18} color="#666" />
      </View>

      <Text style={S.title} numberOfLines={1}>{item.title}</Text>
      {!!item.preview && (
        <Text style={S.preview} numberOfLines={2}>{item.preview}</Text>
      )}
    </Pressable>
  );
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function relTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const S = StyleSheet.create({
  card: {
    backgroundColor: '#1a1a2e', borderRadius: 14, padding: 14,
    marginHorizontal: 12, marginBottom: 10,
    borderLeftWidth: 3,
  },
  cardPressed: { opacity: 0.7 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00d4ff' },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#0a0a0f',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#00d4ff', fontWeight: '700', fontSize: 13 },
  author: { color: '#aaa', fontSize: 14, fontWeight: '500' },
  authorUnread: { color: '#fff', fontWeight: '700' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 },
  metaText: { color: '#666', fontSize: 11 },
  distancePill: {
    backgroundColor: '#0a0a0f',
    paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8,
  },
  distanceText: { color: '#00d4ff', fontSize: 10, fontWeight: '600' },
  title: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 2 },
  preview: { color: '#aaa', fontSize: 13, lineHeight: 18 },
});
""",

    # 9. Pulse — NearbyPeopleStrip --------------------------------------------
    "apps/mobile/src/features/pulse/components/NearbyPeopleStrip.tsx": r"""// apps/mobile/src/features/pulse/components/NearbyPeopleStrip.tsx
//
// Horizontal strip of nearby user avatars, reading from existing discovery
// slice (no new fetch). Empty when the user hasn't visited Map yet — fine.

import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { DiscoveryPoint, EntityPoint, UserMeta } from '@g88/shared';

interface Props {
  points: DiscoveryPoint[];
  onTapUser: (userId: string) => void;
  maxVisible?: number;
}

export function NearbyPeopleStrip(props: Props): React.JSX.Element | null {
  const { points, onTapUser, maxVisible = 6 } = props;

  const users = useMemo<EntityPoint[]>(
    () => points.filter((p): p is EntityPoint => p.kind === 'user').slice(0, 50),
    [points],
  );

  if (users.length === 0) return null;

  const visible = users.slice(0, maxVisible);
  const overflow = Math.max(0, users.length - maxVisible);

  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>{'\u{1F31F}'} Nearby</Text>
        <Text style={S.sectionCount}>{users.length}</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.scroll}
      >
        {visible.map((u) => {
          const meta = u.meta as UserMeta;
          const name = meta.displayName ?? '?';
          const initials = name
            .split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
          const online = meta.online === true;
          return (
            <TouchableOpacity
              key={u.id}
              style={S.userItem}
              onPress={() => onTapUser(u.id)}
              testID={`nearby-user-${u.id}`}
            >
              <View style={S.avatarWrap}>
                <View style={S.avatar}>
                  <Text style={S.avatarText}>{initials}</Text>
                </View>
                {online && <View style={S.onlineDot} />}
              </View>
              <Text style={S.name} numberOfLines={1}>
                {(name.split(' ')[0] ?? '').slice(0, 8)}
              </Text>
            </TouchableOpacity>
          );
        })}
        {overflow > 0 && (
          <View style={S.userItem}>
            <View style={[S.avatar, S.overflowAvatar]}>
              <Text style={S.overflowText}>+{overflow}</Text>
            </View>
            <Text style={S.name}>more</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  section: { paddingTop: 8, paddingBottom: 4 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, marginBottom: 6,
  },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sectionCount: {
    color: '#00d4ff', fontSize: 12, fontWeight: '700',
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 8, paddingVertical: 1, borderRadius: 8,
  },
  scroll: { paddingHorizontal: 12, paddingVertical: 4, gap: 12 },
  userItem: { alignItems: 'center', width: 56 },
  avatarWrap: { position: 'relative' },
  avatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: '#1a1a2e',
    borderWidth: 2, borderColor: '#2a2a4a',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarText: { color: '#00d4ff', fontWeight: '700', fontSize: 15 },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: '#4CAF50',
    borderWidth: 2, borderColor: '#0a0a0f',
  },
  overflowAvatar: { backgroundColor: '#0a0a0f' },
  overflowText: { color: '#aaa', fontWeight: '700', fontSize: 13 },
  name: { color: '#aaa', fontSize: 11, marginTop: 4, maxWidth: 56 },
});
""",

    # 10. Pulse — TrendingStrip -----------------------------------------------
    "apps/mobile/src/features/pulse/components/TrendingStrip.tsx": r"""// apps/mobile/src/features/pulse/components/TrendingStrip.tsx
//
// TODO(P2.5/X4): replace `topics` prop with `useTrendingNearby()` hook
// fetching from `/trending/nearby?lat&lng`. Backend (`trending.service`)
// already maintains geohash-bucketed Redis sorted sets — mobile contract
// is the missing piece. Until then PulseScreen passes MOCK_TRENDING.

import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  topics: string[];
  onTapTopic: (topic: string) => void;
}

export function TrendingStrip(props: Props): React.JSX.Element | null {
  const { topics, onTapTopic } = props;
  if (topics.length === 0) return null;

  return (
    <View style={S.section}>
      <View style={S.sectionHeader}>
        <Text style={S.sectionTitle}>{'\u{1F525}'} Trending nearby</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={S.scroll}
      >
        {topics.map((t) => (
          <TouchableOpacity
            key={t}
            style={S.topic}
            onPress={() => onTapTopic(t)}
            testID={`trending-topic-${t}`}
          >
            <Text style={S.topicText}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  section: { paddingTop: 8 },
  sectionHeader: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: { color: '#fff', fontSize: 14, fontWeight: '600' },
  scroll: { paddingHorizontal: 12, paddingVertical: 4, gap: 8 },
  topic: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1, borderColor: '#2a2a4a',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14,
  },
  topicText: { color: '#00d4ff', fontSize: 13, fontWeight: '600' },
});
""",

    # 11. Pulse — Screen (v2 replacement) -------------------------------------
    "apps/mobile/src/features/pulse/PulseScreen.tsx": r"""// apps/mobile/src/features/pulse/PulseScreen.tsx
//
// Pulse v2 — Nextdoor-style activity hub.
//   Layout: header + share-CTA + filter chips + nearby strip + cards + trending
//   Data:   `/feed` (existing) for cards; `discovery.points` for nearby strip;
//           mock array for trending until X4 lands.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import type { ActivityItem, ActivityType } from '@g88/shared';
import type { PulseFilter, RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchFeed, clearPendingFilter } from './pulseSlice';

import { ShareCTA } from './components/ShareCTA';
import { ActivityCard } from './components/ActivityCard';
import { NearbyPeopleStrip } from './components/NearbyPeopleStrip';
import { TrendingStrip } from './components/TrendingStrip';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<TabParamList, 'Pulse'>;

interface FilterDef { key: PulseFilter; label: string; type: ActivityType | null }

const FILTERS: FilterDef[] = [
  { key: 'all',      label: 'All',     type: null },
  { key: 'chats',    label: 'Chats',   type: 'chat' },
  { key: 'waves',    label: 'Waves',   type: 'wave' },
  { key: 'listings', label: 'Trades',  type: 'listing' },
  { key: 'alerts',   label: 'Alerts',  type: 'alert' },
  { key: 'matches',  label: 'Matches', type: 'match' },
];

// TODO(P2.5/X4): swap to real `/trending/nearby` data.
const MOCK_TRENDING: string[] = [
  '#coffee', '#flea-market', '#yoga', '#beach-cleanup', '#open-mic',
];

export function PulseScreen(): React.JSX.Element {
  const dispatch = useAppDispatch();
  const navigation = useNavigation<Nav>();
  const route = useRoute<R>();

  const { items, loading, error, pendingFilter } = useAppSelector((s) => s.pulse);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const discoveryPoints = useAppSelector((s) => (s as any).discovery?.points ?? []);

  const [filter, setFilter] = useState<PulseFilter>(route.params?.filter ?? 'all');

  // ─── Filter sync ────────────────────────────────────────────────────────
  useEffect(() => {
    if (route.params?.filter) setFilter(route.params.filter);
  }, [route.params?.filter]);

  useEffect(() => {
    if (pendingFilter) {
      setFilter(pendingFilter as PulseFilter);
      dispatch(clearPendingFilter());
    }
  }, [pendingFilter, dispatch]);

  // ─── Data load ──────────────────────────────────────────────────────────
  const load = useCallback(() => {
    const f = FILTERS.find((x) => x.key === filter);
    void dispatch(fetchFeed(f?.type ? { types: [f.type] } : {}));
  }, [dispatch, filter]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const filtered = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    return f?.type ? items.filter((i) => i.type === f.type) : items;
  }, [items, filter]);

  // ─── Tap routing ────────────────────────────────────────────────────────
  const onTap = useCallback((it: ActivityItem): void => {
    const { screen, params } = it.deepLink;
    if (screen === 'Main') {
      navigation.navigate('Main', params as never);
    } else {
      navigation.navigate(screen as keyof RootStackParamList, params as never);
    }
  }, [navigation]);

  const openAlertComposer = useCallback(() => {
    navigation.navigate('AlertComposer', { presetCategory: 'general' });
  }, [navigation]);

  // ─── Header (CTA + chips + nearby) ─────────────────────────────────────
  const Header = (
    <View>
      <View style={S.headerBar}>
        <Text style={S.headerTitle}>Pulse</Text>
      </View>

      <ShareCTA onPress={openAlertComposer} />

      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={S.chips} contentContainerStyle={S.chipsContent}
      >
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[S.chip, active && S.chipActive]}
              onPress={() => setFilter(f.key)}
              testID={`pulse-filter-${f.key}`}
            >
              <Text style={[S.chipText, active && S.chipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <NearbyPeopleStrip
        points={discoveryPoints}
        onTapUser={(userId) => navigation.navigate('UserProfile', { userId })}
      />
    </View>
  );

  // ─── Footer (trending) ─────────────────────────────────────────────────
  const Footer = (
    <View style={S.footer}>
      <TrendingStrip
        topics={MOCK_TRENDING}
        onTapTopic={(t) =>
          navigation.navigate('AlertComposer', { presetCategory: 'general', presetTag: t })
        }
      />
    </View>
  );

  // ─── Body ──────────────────────────────────────────────────────────────
  if (loading && items.length === 0) {
    return (
      <View style={S.container}>
        {Header}
        <View style={S.center}><ActivityIndicator color="#00d4ff" /></View>
      </View>
    );
  }
  if (error) {
    return (
      <View style={S.container}>
        {Header}
        <View style={S.center}>
          <Text style={S.errorText}>{error}</Text>
          <TouchableOpacity onPress={load} style={S.retry}>
            <Text style={S.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={S.container}>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => <ActivityCard item={item} onPress={() => onTap(item)} />}
        ListHeaderComponent={Header}
        ListFooterComponent={Footer}
        ListEmptyComponent={
          <View style={S.empty}>
            <MCI name="pulse" size={40} color="#2a2a4a" />
            <Text style={S.emptyTitle}>Quiet around here</Text>
            <Text style={S.emptyBody}>Pull to refresh, or share what's happening.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={load} tintColor="#00d4ff" />
        }
        contentContainerStyle={{ paddingBottom: 140 }}
      />
    </View>
  );
}

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0f' },

  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4,
  },
  headerTitle: { color: '#fff', fontSize: 28, fontWeight: '700' },

  chips: { maxHeight: 50 },
  chipsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#2a2a4a',
  },
  chipActive: { backgroundColor: '#00d4ff', borderColor: '#00d4ff' },
  chipText: { color: '#aaa', fontSize: 13, fontWeight: '500' },
  chipTextActive: { color: '#0a0a0f', fontWeight: '700' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: '#ff6b6b', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  retry: {
    backgroundColor: '#00d4ff',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
  },
  retryText: { color: '#0a0a0f', fontWeight: '700' },

  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 12 },
  emptyBody: { color: '#666', fontSize: 13, marginTop: 4 },

  footer: { paddingTop: 20, paddingBottom: 30 },
});
""",
}


# ─── Patches (surgical str.replace, idempotent) ─────────────────────────────

PATCHES: list[dict] = [

    # AppNavigator: remove ActionHub import, add AlertComposer route ---------
    {
        "path": "apps/mobile/src/navigation/AppNavigator.tsx",
        "label": "AppNavigator: AlertComposer route + ActionHub removal",
        "changes": [
            # Remove the ActionHub import line (if present from R5)
            {
                "old": "import { ActionHub } from '@/components/ActionHub';\n",
                "new": "",
                "optional": True,
                "applied_marker": None,
            },
            # Remove any <ActionHub /> JSX (R5 may or may not have placed it)
            {
                "old": "      <ActionHub />\n",
                "new": "",
                "optional": True,
                "applied_marker": None,
            },
            {
                "old": "        <ActionHub />\n",
                "new": "",
                "optional": True,
                "applied_marker": None,
            },
            {
                "old": "          <ActionHub />\n",
                "new": "",
                "optional": True,
                "applied_marker": None,
            },
            # Add AlertComposer + AreaCategory imports after PulseScreen import
            {
                "old": "import { PulseScreen } from '@/features/pulse/PulseScreen';",
                "new": (
                    "import { PulseScreen } from '@/features/pulse/PulseScreen';\n"
                    "import { AlertComposerScreen } from '@/screens/AlertComposerScreen';\n"
                    "import type { AreaCategory } from '@g88/shared';"
                ),
                "optional": False,
                "applied_marker": "AlertComposerScreen",
            },
            # Add AlertComposer to RootStackParamList (before closing brace)
            {
                "old": "  Settings: undefined;\n};",
                "new": (
                    "  Settings: undefined;\n"
                    "  AlertComposer: { presetCategory?: AreaCategory; presetTag?: string };\n"
                    "  UserProfile: { userId: string };\n"
                    "};"
                ),
                "optional": False,
                "applied_marker": "AlertComposer: { presetCategory",
            },
            # Register AlertComposer Stack.Screen after Settings screen
            {
                "old": '<Stack.Screen name="Settings" component={SettingsScreen} />',
                "new": (
                    '<Stack.Screen name="Settings" component={SettingsScreen} />\n'
                    '        <Stack.Screen\n'
                    '          name="AlertComposer"\n'
                    '          component={AlertComposerScreen}\n'
                    "          options={{ presentation: 'modal' }}\n"
                    '        />'
                ),
                "optional": False,
                "applied_marker": 'name="AlertComposer"',
            },
        ],
    },

    # MapScreen: mount ContextualFab + wire wave_nearest interception --------
    {
        "path": "apps/mobile/src/screens/MapScreen.tsx",
        "label": "MapScreen: mount ContextualFab + onFabAction",
        "changes": [
            # Add imports right after the ErrorBoundary import (known anchor)
            {
                "old": "import { ErrorBoundary } from '@/components/ErrorBoundary';",
                "new": (
                    "import { ErrorBoundary } from '@/components/ErrorBoundary';\n"
                    "import { ContextualFab } from '@/components/ContextualFab';\n"
                    "import type { FabActionId } from '@/components/ContextualFab/useFabContext';\n"
                    "import { track } from '@/lib/analytics';"
                ),
                "optional": False,
                "applied_marker": "from '@/components/ContextualFab'",
            },
            # Inject nearestUserId + onFabAction right before the return JSX.
            # Anchor: the `return (` opening of the component JSX. Brittle but
            # the file has exactly one such line in this component.
            {
                "old": "  return (\n    <View style={styles.root}>",
                "new": (
                    "  const nearestUserId = useMemo(() => {\n"
                    "    const users = (data?.points ?? []).filter((p) => p.kind === 'user');\n"
                    "    return users[0]?.id ?? null;\n"
                    "  }, [data]);\n"
                    "\n"
                    "  const onFabAction = useCallback(async (id: FabActionId, contextKey: string): Promise<boolean> => {\n"
                    "    if (id === 'wave_nearest' && nearestUserId) {\n"
                    "      const t0 = Date.now();\n"
                    "      try {\n"
                    "        await onWave(nearestUserId);\n"
                    "        track('fab.conversion', { contextKey, actionId: id, latencyMs: Date.now() - t0, success: true });\n"
                    "      } catch {\n"
                    "        track('fab.conversion', { contextKey, actionId: id, latencyMs: Date.now() - t0, success: false });\n"
                    "      }\n"
                    "      return true;\n"
                    "    }\n"
                    "    return false;\n"
                    "  }, [nearestUserId, onWave]);\n"
                    "\n"
                    "  return (\n    <View style={styles.root}>"
                ),
                "optional": False,
                "applied_marker": "const onFabAction = useCallback",
            },
            # Mount <ContextualFab /> at the very end of the root View.
            # Anchor: the very last `</View>` of the component, preceded by EntityBottomSheet's closing brace.
            {
                "old": "      )}\n    </View>\n  );\n}",
                "new": (
                    "      )}\n"
                    "\n"
                    "      <ContextualFab\n"
                    "        zoom={zoom}\n"
                    "        points={data?.points ?? []}\n"
                    "        nearestUserId={nearestUserId}\n"
                    "        onAction={onFabAction}\n"
                    "      />\n"
                    "    </View>\n  );\n}"
                ),
                "optional": False,
                "applied_marker": "<ContextualFab",
            },
        ],
    },
]


# ─── Moves (idempotent rollback-safety relocation) ──────────────────────────

MOVES: list[tuple[str, str]] = [
    (
        "apps/mobile/src/components/ActionHub.tsx",
        "apps/mobile/src/components/_deprecated/ActionHub.tsx",
    ),
    (
        "apps/mobile/src/components/actionHubActions.ts",
        "apps/mobile/src/components/_deprecated/actionHubActions.ts",
    ),
    (
        "apps/mobile/src/components/__tests__/actionHubActions.spec.ts",
        "apps/mobile/src/components/_deprecated/__tests__/actionHubActions.spec.ts",
    ),
]


# ─── Execution helpers ──────────────────────────────────────────────────────

def write_file(rel: str, content: str) -> str:
    path = ROOT / rel
    if DRY:
        existed = path.exists()
        return f"[DRY] {'overwrite' if existed else 'create  '} {rel} ({len(content)} bytes)"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="\n")
    return f"   ok   {rel}"


def apply_patch(rel: str, label: str, changes: list[dict]) -> list[str]:
    path = ROOT / rel
    if not path.exists():
        return [f"   !! {rel} not found — SKIPPED entire patch '{label}'"]

    src = path.read_text(encoding="utf-8")
    out = [f"-- patching {rel} ({label})"]
    new = src
    any_change = False

    for i, ch in enumerate(changes, 1):
        old = ch["old"]
        new_str = ch["new"]
        optional = ch.get("optional", False)
        marker = ch.get("applied_marker")

        # Idempotency: if marker present, skip silently
        if marker and marker in new:
            out.append(f"   !  change {i}: already applied (marker '{marker[:40]}...')")
            continue

        count = new.count(old)
        if count == 0:
            if optional:
                out.append(f"   !  change {i}: optional anchor not found — skipped")
                continue
            out.append(f"   FAIL change {i}: anchor not found — {old[:80]!r}")
            return out
        if count > 1:
            out.append(f"   FAIL change {i}: anchor appears {count}x — refusing ambiguous edit")
            return out

        new = new.replace(old, new_str, 1)
        any_change = True
        out.append(f"   ok change {i}")

    if any_change and not DRY:
        path.write_text(new, encoding="utf-8", newline="\n")
        out.append(f"   wrote {rel}")
    elif any_change and DRY:
        out.append(f"   [DRY] would write {rel}")
    else:
        out.append(f"   noop {rel} (all changes already applied)")
    return out


def move_file(src_rel: str, dst_rel: str) -> str:
    src = ROOT / src_rel
    dst = ROOT / dst_rel
    if not src.exists() and dst.exists():
        return f"   !  {src_rel} already moved -> {dst_rel}"
    if not src.exists():
        return f"   !  {src_rel} missing (and no target) — skipped"
    if dst.exists():
        return f"   !  {dst_rel} already exists — leaving {src_rel} alone"
    if DRY:
        return f"[DRY] move {src_rel} -> {dst_rel}"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(src), str(dst))
    return f"   ok move {src_rel} -> {dst_rel}"


# ─── Main ───────────────────────────────────────────────────────────────────

def main() -> int:
    banner = "=" * 60
    print(banner)
    print(f"  install-pulse-v2  ({'DRY RUN' if DRY else 'APPLY'})")
    print(f"  root: {ROOT}")
    print(banner)
    print()

    # 1. Files
    print(f"[1/3] {len(FILES)} files")
    for rel, content in FILES.items():
        print(write_file(rel, content))
    print()

    # 2. Patches
    print(f"[2/3] {len(PATCHES)} patches")
    for p in PATCHES:
        for line in apply_patch(p["path"], p["label"], p["changes"]):
            print(line)
    print()

    # 3. Moves (rollback safety)
    print(f"[3/3] {len(MOVES)} moves (legacy rollback safety)")
    for src_rel, dst_rel in MOVES:
        print(move_file(src_rel, dst_rel))
    print()

    print(banner)
    print("Next steps:")
    print("  1. pnpm --filter @g88/mobile typecheck")
    print("  2. pnpm --filter @g88/mobile test")
    print("  3. pnpm --filter @g88/mobile android   # smoke-test on device")
    print("  4. Update STATUS.md (add P2.5 section) + ARCHITECTURE.md change log")
    print(banner)
    return 0


if __name__ == "__main__":
    sys.exit(main())
