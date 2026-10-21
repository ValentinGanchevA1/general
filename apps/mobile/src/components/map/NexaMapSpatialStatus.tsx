import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useAppTheme } from '@/theme';
import {
  NEXA_MOTION_SCALE,
  resolveNexaMotionDuration,
} from '@/motion/nexaMotion';
import { useNexaReducedMotion } from '@/motion/useNexaReducedMotion';
import { resolveNexaRetryActionLabel } from '@/product/nexaActionLanguage';

import type { MapEmptyCopy } from './mapEmptyCopy';
import type { NexaMapSpatialState } from './nexaMapSpatialStates';

type SpatialAction = 'none' | 'empty' | 'retry' | 'zoom';
type SpatialTone = 'discovery' | 'action' | 'warning';

interface SpatialPresentation {
  eyebrow: string;
  title: string;
  body: string;
  icon: string | null;
  actionLabel: string | null;
  action: SpatialAction;
  tone: SpatialTone;
  compact: boolean;
}

export interface NexaMapSpatialStatusProps {
  state: NexaMapSpatialState;
  emptyCopy: MapEmptyCopy;
  hidden?: boolean;
  onEmptyAction: () => void;
  onRetry: () => void;
  onZoomIn: () => void;
}

/** Map-first state surface: status UI stays contextual and never replaces the map. */
export function NexaMapSpatialStatus({
  state,
  emptyCopy,
  hidden = false,
  onEmptyAction,
  onRetry,
  onZoomIn,
}: NexaMapSpatialStatusProps): React.JSX.Element | null {
  const { colors, shadow } = useAppTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useNexaReducedMotion();
  const presentation = useMemo(() => presentationFor(state, emptyCopy), [state, emptyCopy]);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(8));
  const [scale] = useState(() => new Animated.Value(NEXA_MOTION_SCALE.enter));

  useEffect(() => {
    if (hidden || state === 'ready') return;
    opacity.setValue(0);
    translateY.setValue(reduceMotion ? 0 : 8);
    scale.setValue(reduceMotion ? 1 : NEXA_MOTION_SCALE.enter);
    const duration = resolveNexaMotionDuration('standard', reduceMotion, 'crossfade');
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration, useNativeDriver: true }),
    ]).start();
  }, [hidden, opacity, reduceMotion, scale, state, translateY]);

  if (hidden || state === 'ready') return null;

  const accent = presentation.tone === 'action' ? colors.actionPrimary : presentation.tone === 'warning' ? colors.warning : colors.discovery;
  const borderColor = presentation.tone === 'action' ? colors.actionBorderSoft : presentation.tone === 'warning' ? colors.borderStrong : colors.discoveryBorderSoft;
  const tintedSurface = presentation.tone === 'action' ? colors.actionSoft : presentation.tone === 'warning' ? colors.surfaceSecondary : colors.discoverySoft;
  const onAction = presentation.action === 'empty' ? onEmptyAction : presentation.action === 'retry' ? onRetry : presentation.action === 'zoom' ? onZoomIn : null;
  const liveRegionMode = state === 'error' || state === 'stale-error' ? 'assertive' : 'polite';
  const isEmpty = state === 'empty';

  return (
    <View
      pointerEvents="box-none"
      style={[
        presentation.compact ? styles.compactWrap : isEmpty ? styles.emptyWrap : styles.centerWrap,
        presentation.compact ? { bottom: insets.bottom + 88 } : null,
      ]}
    >
      <Animated.View
        accessibilityRole="summary"
        accessibilityLiveRegion={liveRegionMode}
        style={[
          presentation.compact ? styles.compactCard : isEmpty ? styles.emptyCard : styles.card,
          { backgroundColor: colors.surfacePrimary, borderColor, opacity, transform: [{ translateY }, { scale }] },
          shadow(isEmpty ? 0.16 : 0.22),
        ]}
      >
        {presentation.compact ? (
          <View style={[styles.compactGlyph, { backgroundColor: tintedSurface, borderColor }]}>
            <MaterialCommunityIcons name={presentation.icon ?? 'map-marker-radius-outline'} size={18} color={accent} />
          </View>
        ) : isEmpty ? (
          <View style={[styles.emptyGlyph, { backgroundColor: tintedSurface, borderColor }]}>
            <MaterialCommunityIcons name={presentation.icon ?? 'map-marker-radius-outline'} size={21} color={accent} />
          </View>
        ) : (
          <SpatialGeometry tone={presentation.tone} />
        )}

        <View style={[styles.copy, isEmpty && styles.emptyCopy]}>
          <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1}>{presentation.eyebrow}</Text>
          <Text style={[presentation.compact ? styles.compactTitle : isEmpty ? styles.emptyTitle : styles.title, { color: colors.textPrimary }]}>{presentation.title}</Text>
          {!presentation.compact ? <Text style={[isEmpty ? styles.emptyBody : styles.body, { color: colors.textSecondary }]}>{presentation.body}</Text> : null}
        </View>

        {presentation.icon && !presentation.compact && !isEmpty ? (
          <View style={[styles.contextIcon, { backgroundColor: tintedSurface, borderColor }]}>
            <MaterialCommunityIcons name={presentation.icon} size={20} color={accent} />
          </View>
        ) : null}

        {presentation.actionLabel && onAction ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={presentation.actionLabel}
            onPress={onAction}
            hitSlop={6}
            style={({ pressed }) => [
              presentation.compact ? styles.compactAction : isEmpty ? styles.emptyAction : styles.action,
              { backgroundColor: presentation.compact ? tintedSurface : colors.actionPrimary, borderColor: presentation.compact ? borderColor : colors.actionPrimary, opacity: pressed ? 0.82 : 1 },
            ]}
          >
            <Text style={[presentation.compact ? styles.compactActionText : styles.actionText, { color: presentation.compact ? accent : colors.onPrimary }]}>{presentation.actionLabel}</Text>
          </Pressable>
        ) : null}
      </Animated.View>
    </View>
  );
}

function SpatialGeometry({ tone }: { tone: SpatialTone }): React.JSX.Element {
  const { colors } = useAppTheme();
  const listingColor = colors.textSecondary;
  const activeOutline = tone === 'warning' ? colors.warning : colors.discovery;
  return (
    <View style={styles.geometry} accessible accessibilityRole="image" accessibilityLabel="NEXA nearby discovery">
      <View style={[styles.geometryRing, { borderColor: activeOutline + '66' }]} />
      <View style={[styles.circle, { backgroundColor: colors.entityPerson }]} />
      <View style={[styles.diamond, { backgroundColor: colors.entityEvent }]} />
      <View style={[styles.square, { backgroundColor: listingColor }]} />
    </View>
  );
}

function presentationFor(state: NexaMapSpatialState, emptyCopy: MapEmptyCopy): SpatialPresentation {
  switch (state) {
    case 'starting': return { eyebrow: 'NEXA discovery', title: 'Preparing the map', body: 'Your map stays primary while nearby discovery becomes ready.', icon: null, actionLabel: null, action: 'none', tone: 'discovery', compact: false };
    case 'loading': return { eyebrow: 'Nearby discovery', title: 'Reading nearby activity', body: 'People, events and listings will surface directly on the map.', icon: null, actionLabel: null, action: 'none', tone: 'discovery', compact: false };
    case 'refreshing': return { eyebrow: 'Nearby discovery', title: 'Refreshing this view', body: '', icon: 'sync', actionLabel: null, action: 'none', tone: 'discovery', compact: true };
    case 'empty': return { eyebrow: emptyCopy.eyebrow, title: emptyCopy.title, body: emptyCopy.body, icon: emptyCopy.icon, actionLabel: emptyCopy.actionLabel, action: 'empty', tone: 'action', compact: false };
    case 'error': return { eyebrow: 'Nearby signal interrupted', title: 'Discovery did not load', body: 'The map is still available. Retry nearby discovery without changing your filters.', icon: 'cloud-refresh-outline', actionLabel: resolveNexaRetryActionLabel('discovery'), action: 'retry', tone: 'warning', compact: false };
    case 'stale-error': return { eyebrow: 'Nearby signal interrupted', title: 'Showing the last nearby view', body: '', icon: 'cloud-alert-outline', actionLabel: resolveNexaRetryActionLabel('discovery'), action: 'retry', tone: 'warning', compact: true };
    case 'zoom-in': return { eyebrow: 'Discovery range', title: 'Move closer to discover', body: 'Zoom in to reveal local people, events and listings with useful nearby context.', icon: 'magnify-plus-outline', actionLabel: 'Zoom in', action: 'zoom', tone: 'discovery', compact: false };
    case 'ready': return { eyebrow: '', title: '', body: '', icon: null, actionLabel: null, action: 'none', tone: 'discovery', compact: false };
  }
}

const styles = StyleSheet.create({
  centerWrap: { ...StyleSheet.absoluteFillObject, zIndex: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  emptyWrap: { ...StyleSheet.absoluteFillObject, zIndex: 18, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, transform: [{ translateY: -24 }] },
  compactWrap: { position: 'absolute', left: 16, right: 16, zIndex: 18, alignItems: 'center' },
  card: { width: '100%', maxWidth: 360, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.xl, paddingVertical: spacing.xl, alignItems: 'center', overflow: 'hidden' },
  emptyCard: { width: '100%', maxWidth: 344, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, alignItems: 'center', overflow: 'hidden' },
  compactCard: { minHeight: 52, maxWidth: 360, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingLeft: 8, paddingRight: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  geometry: { width: 76, height: 52, marginBottom: spacing.md, alignItems: 'center', justifyContent: 'center' },
  geometryRing: { position: 'absolute', width: 66, height: 42, borderRadius: 21, borderWidth: 1 },
  circle: { position: 'absolute', left: 13, top: 19, width: 14, height: 14, borderRadius: 7 },
  diamond: { position: 'absolute', left: 31, top: 17, width: 16, height: 16, transform: [{ rotate: '45deg' }] },
  square: { position: 'absolute', right: 13, top: 19, width: 14, height: 14, borderRadius: 3 },
  compactGlyph: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  emptyGlyph: { width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm },
  copy: { flexShrink: 1, alignItems: 'center' },
  emptyCopy: { maxWidth: 292 },
  eyebrow: { fontSize: 11, lineHeight: 14, fontWeight: '800', letterSpacing: 0.7, textTransform: 'uppercase', textAlign: 'center' },
  title: { marginTop: 6, fontSize: 19, lineHeight: 24, fontWeight: '800', textAlign: 'center' },
  emptyTitle: { marginTop: 4, fontSize: 17, lineHeight: 22, fontWeight: '800', textAlign: 'center' },
  compactTitle: { marginTop: 2, fontSize: 13, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
  body: { marginTop: 8, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyBody: { marginTop: 6, fontSize: 13, lineHeight: 18, textAlign: 'center' },
  contextIcon: { width: 38, height: 38, marginTop: spacing.md, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  action: { minHeight: 46, marginTop: spacing.lg, paddingHorizontal: spacing.xl, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  emptyAction: { minHeight: 44, marginTop: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '800' },
  compactAction: { minHeight: 44, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  compactActionText: { fontSize: 12, fontWeight: '800' },
});
