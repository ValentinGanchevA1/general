import { getDiscoveryPointKey, type DiscoveryPoint, type DiscoveryPointKey } from '@g88/shared';

export interface RenderableMapSelection {
  selectedEntityKey: string | null;
  interactionFocused: boolean;
}

/**
 * Reconciles product selection with the points the renderer can currently draw.
 * A QuickPeek may intentionally survive viewport movement, but a missing marker
 * must not leave the renderer in a ghost selected/dimmed state.
 */
export function resolveRenderableMapSelection(
  points: readonly DiscoveryPoint[],
  selectedEntityKey: string | null,
  dimUnselected: boolean,
): RenderableMapSelection {
  if (selectedEntityKey === null) {
    return {
      selectedEntityKey: null,
      interactionFocused: dimUnselected,
    };
  }

  const selectedKey = selectedEntityKey as DiscoveryPointKey;
  const selectionIsRenderable = points.some(
    (point) => getDiscoveryPointKey(point) === selectedKey,
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
