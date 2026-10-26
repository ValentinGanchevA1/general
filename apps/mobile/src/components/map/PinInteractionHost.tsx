import React, {useEffect, useRef} from 'react';

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
 * Map user-pin taps now hand off directly to EntityBottomSheet once the
 * pinInteraction machine has loaded the peer. Keep the legacy callback surface
 * while the internal preview state still exists, but do not render a second
 * floating callout before the sheet.
 */
export function PinInteractionHost({
  visible,
  previewProps,
  onOpenDetail,
}: Props): React.JSX.Element | null {
  const handedOffRef = useRef(false);

  useEffect(() => {
    if (!visible || previewProps == null) {
      handedOffRef.current = false;
      return;
    }
    if (handedOffRef.current) return;
    handedOffRef.current = true;
    onOpenDetail();
  }, [visible, previewProps, onOpenDetail]);

  return null;
}
