import type { DiscoveryPoint } from '../../packages/shared/src/api';
import {
  previewRasterTileUrl,
  resolveMapRuntime,
  type NexaMapRuntime,
} from './map-runtime';
import { mountMapLibreMap } from './maplibre-map';

export interface MapCenter {
  lat: number;
  lng: number;
}

export interface MapViewport {
  ne: MapCenter;
  sw: MapCenter;
}

export interface MapCamera {
  center: MapCenter;
  zoom: number;
}

interface MountNexaMapOptions {
  container: HTMLElement;
  points: DiscoveryPoint[];
  camera: MapCamera;
  runtime?: NexaMapRuntime;
  onViewportSettled: (camera: MapCamera, viewport: MapViewport) => void;
}

interface MapController {
  updatePoints(points: DiscoveryPoint[]): void;
}

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startCenterX: number;
  startCenterY: number;
}

const TILE_SIZE = 256;
const MIN_ZOOM = 10;
const MAX_ZOOM = 18;
const MAX_LAT = 85.05112878;
const mapControllers = new WeakMap<HTMLElement, MapController>();

export function mountNexaMap(options: MountNexaMapOptions): void {
  const { container, points, onViewportSettled } = options;
  const existing = mapControllers.get(container);
  if (existing) {
    existing.updatePoints(points);
    return;
  }

  const runtime = options.runtime ?? resolveMapRuntime(window.location);

  if (runtime.status === 'ready' && runtime.renderer === 'maplibre') {
    const controller = mountMapLibreMap({
      container,
      points,
      camera: options.camera,
      runtime,
      onViewportSettled,
    });
    mapControllers.set(container, controller);
    return;
  }

  let currentPoints = points;
  let camera: MapCamera = normalizeCamera(options.camera);
  let drag: DragState | null = null;
  let frame = 0;
  let settleTimer: number | null = null;

  const surface = document.createElement('div');
  surface.className = 'slippy-surface';
  surface.tabIndex = 0;
  surface.dataset.mapRuntimeStatus = runtime.status;
  surface.dataset.mapRenderer = runtime.renderer;
  surface.dataset.basemapProvider = runtime.provider;
  surface.dataset.mapUpdateCount = '0';
  surface.setAttribute('role', 'application');
  surface.setAttribute('aria-label', 'Interactive map. Drag to pan and use plus or minus to zoom.');
  if (runtime.status === 'blocked') surface.classList.add('basemap-blocked');

  const tileLayer = document.createElement('div');
  tileLayer.className = 'tile-layer';
  const featureLayer = document.createElement('div');
  featureLayer.className = 'feature-layer';

  const controls = document.createElement('div');
  controls.className = 'map-controls';
  const zoomIn = controlButton('+', 'Zoom in');
  const zoomOut = controlButton('−', 'Zoom out');
  controls.append(zoomIn, zoomOut);

  const attribution = document.createElement('div');
  attribution.className = 'map-attribution';
  if (runtime.status === 'ready' && runtime.renderer === 'preview-raster') {
    const attributionLink = document.createElement('a');
    attributionLink.href = runtime.attributionUrl;
    attributionLink.target = '_blank';
    attributionLink.rel = 'noopener noreferrer';
    attributionLink.textContent = runtime.attribution;
    attribution.append(attributionLink);
  } else {
    attribution.textContent = runtime.reason === 'production-map-requires-https'
      ? 'Production basemap requires HTTPS'
      : 'Production basemap configuration required';
  }

  const viewportLabel = document.createElement('div');
  viewportLabel.className = 'map-place';
  const viewportTitle = document.createElement('b');
  viewportTitle.textContent = 'Varna';
  const viewportSubtitle = document.createElement('small');
  viewportSubtitle.textContent = runtime.status === 'ready'
    ? 'Drag or zoom to search this area'
    : 'Discovery overlay active · production basemap pending';
  viewportLabel.append(viewportTitle, viewportSubtitle);

  surface.append(tileLayer, featureLayer, controls, viewportLabel, attribution);
  container.replaceChildren(surface);

  const scheduleRender = (): void => {
    if (frame !== 0) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      renderLayers(surface, tileLayer, featureLayer, currentPoints, camera, runtime);
    });
  };

  const settle = (): void => {
    if (settleTimer !== null) window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      settleTimer = null;
      onViewportSettled(camera, viewportFor(surface, camera));
    }, 220);
  };

  const zoomBy = (delta: number, anchorX?: number, anchorY?: number): void => {
    const nextZoom = clamp(Math.round(camera.zoom + delta), MIN_ZOOM, MAX_ZOOM);
    if (nextZoom === camera.zoom) return;

    const rect = surface.getBoundingClientRect();
    const x = anchorX ?? rect.width / 2;
    const y = anchorY ?? rect.height / 2;
    const before = screenToLngLat(surface, camera, x, y);
    const next: MapCamera = { center: camera.center, zoom: nextZoom };
    const after = screenToLngLat(surface, next, x, y);

    camera = normalizeCamera({
      zoom: nextZoom,
      center: {
        lng: camera.center.lng + (before.lng - after.lng),
        lat: camera.center.lat + (before.lat - after.lat),
      },
    });
    scheduleRender();
    settle();
  };

  zoomIn.addEventListener('click', () => zoomBy(1));
  zoomOut.addEventListener('click', () => zoomBy(-1));

  surface.addEventListener('wheel', (event) => {
    event.preventDefault();
    const rect = surface.getBoundingClientRect();
    zoomBy(event.deltaY < 0 ? 1 : -1, event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  surface.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const center = lngLatToWorld(camera.center.lng, camera.center.lat, camera.zoom);
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startCenterX: center.x,
      startCenterY: center.y,
    };
    surface.setPointerCapture(event.pointerId);
    surface.classList.add('dragging');
  });

  surface.addEventListener('pointermove', (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    camera = {
      zoom: camera.zoom,
      center: worldToLngLat(drag.startCenterX - dx, drag.startCenterY - dy, camera.zoom),
    };
    scheduleRender();
  });

  const finishDrag = (event: PointerEvent): void => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag = null;
    surface.classList.remove('dragging');
    settle();
  };
  surface.addEventListener('pointerup', finishDrag);
  surface.addEventListener('pointercancel', finishDrag);

  surface.addEventListener('keydown', (event) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomBy(1);
      return;
    }
    if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomBy(-1);
      return;
    }

    const delta = event.shiftKey ? 180 : 90;
    const center = lngLatToWorld(camera.center.lng, camera.center.lat, camera.zoom);
    if (event.key === 'ArrowLeft') center.x -= delta;
    else if (event.key === 'ArrowRight') center.x += delta;
    else if (event.key === 'ArrowUp') center.y -= delta;
    else if (event.key === 'ArrowDown') center.y += delta;
    else return;

    event.preventDefault();
    camera = { zoom: camera.zoom, center: worldToLngLat(center.x, center.y, camera.zoom) };
    scheduleRender();
    settle();
  });

  mapControllers.set(container, {
    updatePoints(nextPoints) {
      currentPoints = nextPoints;
      const nextCount = Number(surface.dataset.mapUpdateCount ?? '0') + 1;
      surface.dataset.mapUpdateCount = String(nextCount);
      scheduleRender();
    },
  });

  renderLayers(surface, tileLayer, featureLayer, currentPoints, camera, runtime);
}

function renderLayers(
  surface: HTMLElement,
  tileLayer: HTMLElement,
  featureLayer: HTMLElement,
  points: DiscoveryPoint[],
  camera: MapCamera,
  runtime: NexaMapRuntime,
): void {
  const width = surface.clientWidth;
  const height = surface.clientHeight;
  if (width <= 0 || height <= 0) return;

  const zoom = Math.round(camera.zoom);
  const center = lngLatToWorld(camera.center.lng, camera.center.lat, zoom);
  const worldSize = TILE_SIZE * 2 ** zoom;
  const left = center.x - width / 2;
  const top = center.y - height / 2;
  const minTileX = Math.floor(left / TILE_SIZE);
  const maxTileX = Math.floor((left + width) / TILE_SIZE);
  const minTileY = Math.max(0, Math.floor(top / TILE_SIZE));
  const maxTileY = Math.min(2 ** zoom - 1, Math.floor((top + height) / TILE_SIZE));
  const tileCount = 2 ** zoom;

  const tileFragment = document.createDocumentFragment();
  if (runtime.status === 'ready' && runtime.renderer === 'preview-raster') {
    for (let tileY = minTileY; tileY <= maxTileY; tileY += 1) {
      for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
        const wrappedX = ((tileX % tileCount) + tileCount) % tileCount;
        const tileUrl = previewRasterTileUrl(runtime, zoom, wrappedX, tileY);
        if (!tileUrl) continue;
        const image = document.createElement('img');
        image.className = 'map-tile';
        image.alt = '';
        image.draggable = false;
        image.decoding = 'async';
        image.referrerPolicy = 'strict-origin-when-cross-origin';
        image.src = tileUrl;
        image.style.left = `${tileX * TILE_SIZE - left}px`;
        image.style.top = `${tileY * TILE_SIZE - top}px`;
        tileFragment.append(image);
      }
    }
  }
  tileLayer.replaceChildren(tileFragment);

  const featureFragment = document.createDocumentFragment();
  for (const point of points) {
    const world = lngLatToWorld(point.lng, point.lat, zoom);
    let dx = world.x - center.x;
    if (dx > worldSize / 2) dx -= worldSize;
    if (dx < -worldSize / 2) dx += worldSize;
    const x = width / 2 + dx;
    const y = height / 2 + world.y - center.y;
    if (x < -36 || x > width + 36 || y < -36 || y > height + 36) continue;

    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = `map-feature ${point.kind}`;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;

    if (point.kind === 'cluster') {
      marker.textContent = String(point.count);
      marker.setAttribute('aria-label', `${point.count} nearby signals`);
    } else if (point.kind === 'user') {
      marker.textContent = initials(point.meta.displayName);
      marker.setAttribute('aria-label', point.meta.displayName);
    } else if (point.kind === 'event') {
      marker.textContent = '◆';
      marker.setAttribute('aria-label', point.meta.title);
    } else {
      marker.textContent = '▣';
      marker.setAttribute('aria-label', point.meta.title);
    }

    featureFragment.append(marker);
  }
  featureLayer.replaceChildren(featureFragment);
}

function viewportFor(surface: HTMLElement, camera: MapCamera): MapViewport {
  const width = surface.clientWidth;
  const height = surface.clientHeight;
  const nw = screenToLngLat(surface, camera, 0, 0);
  const se = screenToLngLat(surface, camera, width, height);
  return {
    ne: { lat: nw.lat, lng: se.lng },
    sw: { lat: se.lat, lng: nw.lng },
  };
}

function screenToLngLat(surface: HTMLElement, camera: MapCamera, x: number, y: number): MapCenter {
  const center = lngLatToWorld(camera.center.lng, camera.center.lat, camera.zoom);
  return worldToLngLat(
    center.x + x - surface.clientWidth / 2,
    center.y + y - surface.clientHeight / 2,
    camera.zoom,
  );
}

function lngLatToWorld(lng: number, lat: number, zoom: number): { x: number; y: number } {
  const size = TILE_SIZE * 2 ** zoom;
  const safeLat = clamp(lat, -MAX_LAT, MAX_LAT);
  const sin = Math.sin((safeLat * Math.PI) / 180);
  return {
    x: ((lng + 180) / 360) * size,
    y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
  };
}

function worldToLngLat(x: number, y: number, zoom: number): MapCenter {
  const size = TILE_SIZE * 2 ** zoom;
  const wrappedX = ((x % size) + size) % size;
  const clampedY = clamp(y, 0, size);
  const lng = (wrappedX / size) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * clampedY) / size;
  const lat = (180 / Math.PI) * Math.atan(Math.sinh(n));
  return { lat: clamp(lat, -MAX_LAT, MAX_LAT), lng };
}

function normalizeCamera(camera: MapCamera): MapCamera {
  return {
    zoom: clamp(Math.round(camera.zoom), MIN_ZOOM, MAX_ZOOM),
    center: {
      lat: clamp(camera.center.lat, -MAX_LAT, MAX_LAT),
      lng: wrapLng(camera.center.lng),
    },
  };
}

function wrapLng(lng: number): number {
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || 'N';
}

function controlButton(label: string, ariaLabel: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.setAttribute('aria-label', ariaLabel);
  return button;
}
