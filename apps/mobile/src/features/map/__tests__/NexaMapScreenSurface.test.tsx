import React from 'react';
import renderer from 'react-test-renderer';

import { NEXA_MAP_RENDERER_ROLLOUT } from '../mapRendererRollout';
import { NexaMapRuntimeSurface } from '../renderers/NexaMapRuntimeSurface';
import { NexaMapScreenSurface } from '../renderers/NexaMapScreenSurface';

jest.mock('../renderers/NexaMapRuntimeSurface', () => ({
  NexaMapRuntimeSurface: jest.fn(() => null),
}));

const runtimeSurfaceMock = NexaMapRuntimeSurface as jest.MockedFunction<
  typeof NexaMapRuntimeSurface
>;

describe('NexaMapScreenSurface', () => {
  beforeEach(() => {
    runtimeSurfaceMock.mockClear();
  });

  it('owns renderer rollout policy instead of exposing it to MapScreen', () => {
    const onReady = jest.fn();
    const onRegionChangeComplete = jest.fn();
    const onLongPress = jest.fn();
    const onClusterPress = jest.fn();
    const onEntityPress = jest.fn();

    renderer.create(
      <NexaMapScreenSurface
        points={[]}
        selectedEntityKey={null}
        dimUnselected={false}
        mode="dark"
        scheme="dark"
        onReady={onReady}
        onRegionChangeComplete={onRegionChangeComplete}
        onLongPress={onLongPress}
        onClusterPress={onClusterPress}
        onEntityPress={onEntityPress}
      />,
    );

    expect(runtimeSurfaceMock).toHaveBeenCalledTimes(1);
    expect(runtimeSurfaceMock.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        points: [],
        selectedEntityKey: null,
        dimUnselected: false,
        requestedRenderer: NEXA_MAP_RENDERER_ROLLOUT.requestedRenderer,
        mapLibreAvailable: NEXA_MAP_RENDERER_ROLLOUT.mapLibreAvailable,
        onReady,
        onRegionChangeComplete,
        onLongPress,
        onClusterPress,
        onEntityPress,
      }),
    );
  });
});
