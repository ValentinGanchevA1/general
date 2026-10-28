import React, { useCallback, useMemo, useState } from 'react';
import type { Region } from 'react-native-maps';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ClusterPoint, DiscoveryPoint, EntityPoint, Viewport } from '@g88/shared';

import { Config } from '@/config';
import { useAppSelector } from '@/hooks/redux';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { usePlaceMapDiscovery } from '@/features/places/usePlaceMapDiscovery';
import { mergeMapDiscoveryPoints } from '@/features/map/mergeMapDiscoveryPoints';
import type { NexaMapController } from '../contracts/mapRenderer';
import {
  NEXA_MAP_RENDERER_ROLLOUT,
  resolveRemoteMapRendererRequest,
} from '../mapRendererRollout';
import { useMapRendererPolicyLifecycle } from '../useMapRendererPolicyLifecycle';
import { resolveMapLibreStyleRuntime } from '../mapLibreStyleRuntime';
import {
  NexaMapRuntimeSurface,
  type NexaMapRuntimeSurfaceProps,
} from './NexaMapRuntimeSurface';

export type NexaMapScreenSurfaceProps = Omit<
  NexaMapRuntimeSurfaceProps,
  | 'requestedRenderer'
  | 'mapLibreAvailable'
  | 'mapLibreStyle'
  | 'points'
  | 'onEntityPress'
  | 'onClusterPress'
  | 'onRegionChangeComplete'
> & {
  points: DiscoveryPoint[];
  onEntityPress: (point: EntityPoint) => void;
  onClusterPress: (point: ClusterPoint) => void;
  onRegionChangeComplete: (region: Region) => void;
};

const MAPLIBRE_STYLE_RUNTIME = resolveMapLibreStyleRuntime({
  apiKey: Config.MAPTILER_API_KEY,
  mapId: Config.MAPTILER_MAP_ID,
  region: Config.MAPTILER_REGION,
});

function regionToViewport(region: Region | null): Viewport | null {
  if (region == null) return null;
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return {
    sw: { lat: region.latitude - halfLat, lng: region.longitude - halfLng },
    ne: { lat: region.latitude + halfLat, lng: region.longitude + halfLng },
  };
}

function approxZoom(region: Region | null): number {
  if (region == null) return 12;
  const delta = Math.max(region.latitudeDelta, 0.0001);
  return Math.max(0, Math.min(20, Math.floor(Math.log2(360 / delta))));
}

/** Product-facing map surface used by MapScreen. */
export const NexaMapScreenSurface = React.forwardRef<
  NexaMapController,
  NexaMapScreenSurfaceProps
>(function NexaMapScreenSurface(
  {
    points,
    onEntityPress,
    onClusterPress,
    onRegionChangeComplete,
    ...props
  },
  ref,
): React.JSX.Element {
  useMapRendererPolicyLifecycle();

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [settledRegion, setSettledRegion] = useState<Region | null>(null);
  const viewport = useMemo(() => regionToViewport(settledRegion), [settledRegion]);
  const zoom = useMemo(() => approxZoom(settledRegion), [settledRegion]);
  const placeDiscovery = usePlaceMapDiscovery({
    viewport,
    zoom,
    enabled: viewport != null,
  });
  const mergedPoints = useMemo(
    () => mergeMapDiscoveryPoints(points, placeDiscovery.data?.points ?? []),
    [placeDiscovery.data?.points, points],
  );

  const mapLibreEnabled = useAppSelector(
    (state) => state.mapRendererPolicy.mapLibreEnabled,
  );
  const validUntilMs = useAppSelector(
    (state) => state.mapRendererPolicy.validUntilMs,
  );
  const remoteMapLibreEnabled = mapLibreEnabled && validUntilMs > Date.now();
  const requestedRenderer = resolveRemoteMapRendererRequest(
    NEXA_MAP_RENDERER_ROLLOUT.requestedRenderer,
    remoteMapLibreEnabled,
  );

  const handleRegionChangeComplete = useCallback((region: Region): void => {
    setSettledRegion(region);
    onRegionChangeComplete(region);
  }, [onRegionChangeComplete]);

  return (
    <NexaMapRuntimeSurface
      ref={ref}
      {...props}
      points={mergedPoints}
      onRegionChangeComplete={handleRegionChangeComplete}
      onClusterPress={(point) => onClusterPress(point)}
      onEntityPress={(point) => {
        if (point.kind === 'place') {
          navigation.navigate('PlaceDetail', { placeId: point.id });
          return;
        }
        onEntityPress(point);
      }}
      requestedRenderer={requestedRenderer}
      mapLibreAvailable={NEXA_MAP_RENDERER_ROLLOUT.mapLibreAvailable}
      mapLibreStyle={
        MAPLIBRE_STYLE_RUNTIME.status === 'ready'
          ? MAPLIBRE_STYLE_RUNTIME.styleUrl
          : null
      }
    />
  );
});
