import React, { useCallback } from 'react';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

/** Default dimmed backdrop — tap closes. */
export function renderSheetBackdrop(
  props: BottomSheetBackdropProps,
  opacity = 0.55,
): React.JSX.Element {
  return (
    <BottomSheetBackdrop
      {...props}
      disappearsOnIndex={-1}
      appearsOnIndex={0}
      opacity={opacity}
      pressBehavior="close"
    />
  );
}

export function useSheetBackdrop(opacity = 0.55) {
  return useCallback(
    (props: BottomSheetBackdropProps) => renderSheetBackdrop(props, opacity),
    [opacity],
  );
}
