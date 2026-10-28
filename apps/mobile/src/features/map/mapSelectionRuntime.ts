import type { MapDiscoveryPoint } from '@g88/shared';

import { getMapDiscoveryPointKey } from './mapDiscoveryKeys';

export interface RenderableMapSelection {
  selectedEntityKey: string | null;
  interactionFocused: boolean;
}

export function resolveRenderableMapSelection(
  points: readonly MapDiscoveryPoint[],
  selectedEntityKey: string | null,
  dimUnselected: boolean,
): RenderableMapSelection {
  if (selectedEntityKey === null) {
    return {
      selectedEntityKey: null,
      interactionFocused: dimUnselected,
    };
  }

  const selectionIsRenderable = points.some(
    (point) => getMapDiscoveryPointKey(point) === selectedEntityKey,
  );

  if (!selectionIsRenderable) {
    return {
      selectedEntityKey: null,
      interactionFocused: false,
    };
  }

  return {
    selectedEntityKey,
    interactionFocused: true,
  };
}
