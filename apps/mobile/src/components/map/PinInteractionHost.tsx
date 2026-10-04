import React from 'react';
import {StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {PreviewCallout} from './PreviewCallout';
import type {PreviewCalloutProps} from './PreviewCallout';

interface Props {
  visible: boolean;
  previewProps: Omit<
    PreviewCalloutProps,
    'onQuickWave' | 'onQuickLike' | 'onOpenDetail' | 'onDismiss'
  > | null;
  onQuickWave: () => void;
  onQuickLike: () => void;
  onOpenDetail: () => void;
  onDismiss: () => void;
}

/**
 * Stage-1 overlay host for pin preview callout.
 * Anchored above bottom chrome / FAB zone.
 */
export function PinInteractionHost({
  visible,
  previewProps,
  onQuickWave,
  onQuickLike,
  onOpenDetail,
  onDismiss,
}: Props): React.JSX.Element | null {
  const insets = useSafeAreaInsets();

  if (!visible || previewProps == null) return null;

  return (
    <View
      style={[styles.wrap, {bottom: Math.max(insets.bottom, 12) + 72}]}
      pointerEvents="box-none"
    >
      <PreviewCallout
        {...previewProps}
        onQuickWave={onQuickWave}
        onQuickLike={onQuickLike}
        onOpenDetail={onOpenDetail}
        onDismiss={onDismiss}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 40,
  },
});
