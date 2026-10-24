import React, { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { useAppTheme } from '@/theme';

import {
  diamondSideForBoundingSize,
  NEXA_MARKER_TOUCH_SIZE,
  resolveNexaMarkerVisual,
  type NexaEntityType,
  type NexaMarkerDensity,
  type NexaMarkerState,
} from './nexaEntityMarkerVisuals';
import {
  NEXA_MARKER_SELECTION_PULSE_IN_MS,
  NEXA_MARKER_SELECTION_PULSE_OUT_MS,
  shouldAnimateNexaMarkerSelection,
} from './nexaMarkerMotion';

export const NEXA_MARKER_RENDER_HEIGHT = 62;
export const NEXA_MARKER_ANCHOR_Y = NEXA_MARKER_TOUCH_SIZE / 2 / NEXA_MARKER_RENDER_HEIGHT;

export interface NexaEntityMarkerProps {
  entityType: NexaEntityType;
  density?: NexaMarkerDensity;
  state?: NexaMarkerState;
  label?: string;
  caption?: string;
  accessibilityLabel?: string;
  reduceMotion?: boolean;
  onVisualSettled?: () => void;
}

function stateSuffix(state: NexaMarkerState): string {
  const parts: string[] = [];
  if (state.selected) parts.push('selected');
  if (state.live) parts.push('live');
  if (state.verified) parts.push('verified');
  if (state.isNew) parts.push('new');
  if (state.own) parts.push('your item');
  if (state.unavailable) parts.push('unavailable');
  return parts.length > 0 ? `, ${parts.join(', ')}` : '';
}

export function NexaEntityMarker({
  entityType,
  density = 'standard',
  state = {},
  label,
  caption,
  accessibilityLabel,
  reduceMotion = true,
  onVisualSettled,
}: NexaEntityMarkerProps): React.JSX.Element {
  const { colors } = useAppTheme();
  const visual = resolveNexaMarkerVisual(entityType, density, state);
  const [selectionPulse] = useState(() => new Animated.Value(0));
  const animateSelection = shouldAnimateNexaMarkerSelection(
    visual.showSelectedRing,
    reduceMotion,
  );

  useEffect(() => {
    selectionPulse.stopAnimation();
    selectionPulse.setValue(0);

    if (!animateSelection) return undefined;

    const animation = Animated.sequence([
      Animated.timing(selectionPulse, {
        toValue: 1,
        duration: NEXA_MARKER_SELECTION_PULSE_IN_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(selectionPulse, {
        toValue: 0,
        duration: NEXA_MARKER_SELECTION_PULSE_OUT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    animation.start();
    return () => animation.stop();
  }, [animateSelection, selectionPulse]);

  const entityColor =
    entityType === 'person'
      ? colors.entityPerson
      : entityType === 'event'
        ? colors.entityEvent
        : entityType === 'listing'
          ? colors.entityListing
          : colors.entityOpportunity;

  const subtleFill =
    entityType === 'person'
      ? colors.actionSoft
      : entityType === 'event'
        ? colors.discoverySoft
        : entityType === 'opportunity'
          ? colors.actionSoft
          : colors.surfacePrimary;

  const diamondSide = diamondSideForBoundingSize(visual.visualSize);
  const coreStyle: ViewStyle =
    visual.shape === 'circle'
      ? {
          width: visual.visualSize,
          height: visual.visualSize,
          borderRadius: visual.visualSize / 2,
          borderColor: entityColor,
          backgroundColor: subtleFill,
        }
      : visual.shape === 'diamond'
        ? {
            width: diamondSide,
            height: diamondSide,
            borderRadius: Math.max(2, diamondSide * 0.14),
            borderColor: entityColor,
            backgroundColor: subtleFill,
            transform: [{ rotate: '45deg' }],
          }
        : visual.shape === 'square'
          ? {
              width: visual.visualSize * 0.82,
              height: visual.visualSize * 0.82,
              borderRadius: Math.max(3, visual.visualSize * 0.16),
              borderColor: entityColor,
              backgroundColor: colors.surfacePrimary,
            }
          : {
              width: visual.visualSize,
              height: visual.visualSize,
              borderColor: 'transparent',
              backgroundColor: 'transparent',
            };

  const iconSize = Math.max(10, Math.round(visual.visualSize * 0.48));
  const pulseOpacity = selectionPulse.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0.5, 0],
  });
  const pulseScale = selectionPulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.82, 1.22],
  });

  return (
    <View
      style={[styles.root, { opacity: visual.opacity }]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={
        accessibilityLabel ??
        `${entityType}${caption ? `, ${caption}` : ''}${stateSuffix(state)}`
      }
    >
      <View style={styles.markerStage} onLayout={onVisualSettled}>
        {animateSelection ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              styles.selectionPulse,
              {
                borderColor: entityColor,
                shadowColor: entityColor,
                opacity: pulseOpacity,
                transform: [{ scale: pulseScale }],
              },
            ]}
          />
        ) : null}

        {visual.showSelectedRing ? (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              styles.selectedRing,
              {
                borderColor: colors.actionPrimary,
                shadowColor: colors.actionPrimary,
              },
            ]}
          />
        ) : null}

        {visual.showLiveRing ? (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              styles.liveRing,
              {
                borderColor: colors.live,
                shadowColor: colors.live,
              },
            ]}
          />
        ) : null}

        {visual.showOwnRing ? (
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              styles.ownRing,
              { borderColor: colors.actionPrimary },
            ]}
          />
        ) : null}

        <View style={styles.coreStage}>
          {visual.shape === 'star' ? (
            <Icon
              name="star-four-points"
              size={visual.visualSize}
              color={entityColor}
            />
          ) : (
            <>
              <View style={[styles.core, coreStyle]} />
              <View pointerEvents="none" style={styles.iconLayer}>
                {entityType === 'person' && label ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.initials,
                      {
                        color: colors.entityPerson,
                        fontSize: Math.max(9, Math.round(visual.visualSize * 0.38)),
                      },
                    ]}
                  >
                    {label}
                  </Text>
                ) : entityType === 'listing' ? (
                  <Icon name="tag-outline" size={iconSize} color={colors.entityListing} />
                ) : null}
              </View>
            </>
          )}
        </View>

        {visual.showVerifiedBadge ? (
          <View
            pointerEvents="none"
            style={[
              styles.verifiedBadge,
              {
                backgroundColor: colors.surfacePrimary,
                borderColor: colors.verified,
              },
            ]}
          >
            <Icon name="check" size={8} color={colors.verified} />
          </View>
        ) : null}

        {visual.showNewDot ? (
          <View
            pointerEvents="none"
            style={[styles.newDot, { backgroundColor: colors.discovery }]}
          />
        ) : null}

        {visual.showUnavailableSlash ? (
          <View
            pointerEvents="none"
            style={[styles.unavailableSlash, { backgroundColor: colors.textSecondary }]}
          />
        ) : null}
      </View>

      {caption ? (
        <View
          pointerEvents="none"
          style={[
            styles.caption,
            {
              backgroundColor: colors.surfacePrimary,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            numberOfLines={1}
            style={[styles.captionText, { color: entityColor }]}
          >
            {caption}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    width: 88,
    height: NEXA_MARKER_RENDER_HEIGHT,
    alignItems: 'center',
    position: 'relative',
  },
  markerStage: {
    width: NEXA_MARKER_TOUCH_SIZE,
    height: NEXA_MARKER_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  coreStage: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    position: 'absolute',
    borderWidth: 2,
  },
  iconLayer: {
    position: 'absolute',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    maxWidth: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
  },
  selectionPulse: {
    width: 42,
    height: 42,
    borderWidth: 1,
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 6,
  },
  selectedRing: {
    width: 42,
    height: 42,
    borderWidth: 1.5,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  liveRing: {
    width: 38,
    height: 38,
    borderWidth: 1,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  ownRing: {
    width: 34,
    height: 34,
    borderWidth: 1,
  },
  verifiedBadge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  newDot: {
    position: 'absolute',
    right: 4,
    top: 4,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  unavailableSlash: {
    position: 'absolute',
    width: 25,
    height: 2,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
  caption: {
    maxWidth: 88,
    minHeight: 17,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  captionText: {
    fontSize: 9,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
