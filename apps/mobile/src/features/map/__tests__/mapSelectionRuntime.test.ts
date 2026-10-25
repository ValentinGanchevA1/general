import type { DiscoveryPoint } from '@g88/shared';

import { resolveRenderableMapSelection } from '../mapSelectionRuntime';

const USER_POINT = {
  kind: 'user',
  id: 'user-1',
  lat: 42.7,
  lng: 23.3,
  meta: {
    displayName: 'Nexa User',
    avatarUrl: null,
    verification: 'none',
    online: false,
    lastSeenAt: null,
  },
} satisfies DiscoveryPoint;

describe('resolveRenderableMapSelection', () => {
  it('keeps a selection while its marker is renderable', () => {
    expect(
      resolveRenderableMapSelection([USER_POINT], 'user:user-1', false),
    ).toEqual({
      selectedEntityKey: 'user:user-1',
      interactionFocused: true,
    });
  });

  it('clears renderer focus when the selected marker leaves the rendered points', () => {
    expect(
      resolveRenderableMapSelection([], 'user:user-1', true),
    ).toEqual({
      selectedEntityKey: null,
      interactionFocused: false,
    });
  });

  it('preserves explicit dimming when there is no selected entity', () => {
    expect(resolveRenderableMapSelection([USER_POINT], null, true)).toEqual({
      selectedEntityKey: null,
      interactionFocused: true,
    });
  });
});
