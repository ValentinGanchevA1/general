import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
} from 'maplibre-gl';
import type { DiscoveryPoint } from '../../packages/shared/src/api';
import type { MapCamera, MapViewport } from './map';
import type { ReadyProductionMapRuntime } from './map-runtime';

interface MountMapLibreOptions {
  container: HTMLElement;
  points: DiscoveryPoint[];
  camera: MapCamera;
  runtime: ReadyProductionMapRuntime;
  onViewportSettled: (camera: MapCamera, viewport: MapViewport) => void;
}

interface NexaPointFeature {
  type: 'Feature';
  id: string;
  properties: {
    kind: DiscoveryPoint['kind'];
    count: number;
    label: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
}

interface NexaFeatureCollection {
  type: 'FeatureCollection';
  features: NexaPointFeature[];
}

const SOURCE_ID = 'nexa-discovery';
const CLUSTER_LAYER_ID = 'nexa-discovery-clusters';
const USER_LAYER_ID = 'nexa-discovery-users';
const EVENT_LAYER_ID = 'nexa-discovery-events';
const LISTING_LAYER_ID = 'nexa-discovery-listings';
const MIN_ZOOM = 10;
const MAX_ZOOM = 18;

export function mountMapLibreMap(options: MountMapLibreOptions): void {
  const { container, points, camera, runtime, onViewportSettled } = options;

  setWorkerUrl(runtime.workerUrl);

  container.dataset.mapRuntimeStatus = runtime.status;
  container.dataset.mapRenderer = runtime.renderer;
  container.dataset.basemapProvider = runtime.provider;
  container.setAttribute('aria-label', 'Interactive NEXA map. Drag or zoom to search this area.');

  const map = new MapLibreMap({
    container,
    style: runtime.styleUrl,
    center: [camera.center.lng, camera.center.lat],
    zoom: camera.zoom,
    minZoom: MIN_ZOOM,
    maxZoom: MAX_ZOOM,
    bearing: 0,
    pitch: 0,
    dragRotate: false,
    attributionControl: {
      compact: true,
      customAttribution: runtime.attribution,
    },
  });

  map.touchZoomRotate.disableRotation();
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

  let disposed = false;
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    map.remove();
  };

  const observer = new MutationObserver(() => {
    if (!container.isConnected) cleanup();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  map.once('load', () => {
    if (disposed) return;
    addDiscoveryOverlay(map, points);
    container.dataset.mapReady = 'true';
    map.on('moveend', () => {
      if (disposed) return;
      const center = map.getCenter();
      const bounds = map.getBounds();
      onViewportSettled(
        {
          center: { lat: center.lat, lng: center.lng },
          zoom: Math.round(map.getZoom()),
        },
        {
          ne: { lat: bounds.getNorth(), lng: bounds.getEast() },
          sw: { lat: bounds.getSouth(), lng: bounds.getWest() },
        },
      );
    });
  });

  map.on('error', (event) => {
    // Provider/network diagnostics belong in browser telemetry. Do not render
    // raw provider error text into the UI or expose credential-bearing URLs.
    if (event.error) container.dataset.mapLoadError = 'true';
  });
}

function addDiscoveryOverlay(map: MapLibreMap, points: DiscoveryPoint[]): void {
  map.addSource(SOURCE_ID, {
    type: 'geojson',
    data: toFeatureCollection(points),
    cluster: false,
  });

  map.addLayer({
    id: CLUSTER_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'kind'], 'cluster'],
    paint: {
      'circle-color': '#35d9f5',
      'circle-opacity': 0.9,
      'circle-stroke-color': '#081117',
      'circle-stroke-width': 2,
      'circle-radius': [
        'interpolate', ['linear'], ['get', 'count'],
        2, 13,
        20, 20,
        100, 28,
      ],
    },
  });

  map.addLayer({
    id: USER_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'kind'], 'user'],
    paint: {
      'circle-color': '#35d9f5',
      'circle-radius': 8,
      'circle-stroke-color': '#081117',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: EVENT_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'kind'], 'event'],
    paint: {
      'circle-color': '#9d6bff',
      'circle-radius': 9,
      'circle-stroke-color': '#081117',
      'circle-stroke-width': 2,
    },
  });

  map.addLayer({
    id: LISTING_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    filter: ['==', ['get', 'kind'], 'listing'],
    paint: {
      'circle-color': '#f5c451',
      'circle-radius': 8,
      'circle-stroke-color': '#081117',
      'circle-stroke-width': 2,
    },
  });
}

function toFeatureCollection(points: DiscoveryPoint[]): NexaFeatureCollection {
  return {
    type: 'FeatureCollection',
    features: points.map((point) => ({
      type: 'Feature',
      id: point.kind === 'cluster' ? `cluster:${point.cellId}` : `${point.kind}:${point.id}`,
      properties: {
        kind: point.kind,
        count: point.kind === 'cluster' ? point.count : 1,
        label: pointLabel(point),
      },
      geometry: {
        type: 'Point',
        coordinates: [point.lng, point.lat],
      },
    })),
  };
}

function pointLabel(point: DiscoveryPoint): string {
  if (point.kind === 'cluster') return `${point.count} nearby signals`;
  if (point.kind === 'user') return point.meta.displayName;
  return point.meta.title;
}
