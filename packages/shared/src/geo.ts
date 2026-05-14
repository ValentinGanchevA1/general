import * as h3 from 'h3-js';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Map viewport in lat/lng (north-east + south-west corners). */
export interface Viewport {
  ne: LatLng;
  sw: LatLng;
}

/**
 * Map a Google/Apple maps zoom level (~0–20) to an H3 resolution (0–15).
 * Tuned for our discovery use case: low zoom → coarse clusters,
 * high zoom → individual entities.
 *
 * Both the client and the server call this so the agreed-upon resolution
 * matches at request time.
 */
export function h3ResolutionForZoom(zoom: number): number {
  if (zoom < 6) return 4;
  if (zoom < 9) return 5;
  if (zoom < 11) return 6;
  if (zoom < 13) return 7;
  if (zoom < 15) return 8;
  if (zoom < 16) return 9;
  return 10;
}

/**
 * The zoom threshold below which discovery returns clusters
 * and above which it returns individual entities.
 */
export const ENTITY_ZOOM_THRESHOLD = 15;

/** Whether the discovery response at this zoom is expected to be entities (true) or clusters (false). */
export function isEntityZoom(zoom: number): boolean {
  return zoom >= ENTITY_ZOOM_THRESHOLD;
}

/**
 * Convert a Viewport to the GeoJSON-style polygon ring h3.polygonToCells expects.
 * h3-js wants [[lat, lng], ...] in counter-clockwise order with the first point repeated last.
 */
export function viewportToH3Polygon(viewport: Viewport): number[][] {
  const { ne, sw } = viewport;
  return [
    [sw.lat, sw.lng],
    [sw.lat, ne.lng],
    [ne.lat, ne.lng],
    [ne.lat, sw.lng],
    [sw.lat, sw.lng],
  ];
}

/**
 * Enumerate all H3 cells at `resolution` that intersect the viewport.
 * If the viewport degenerates (e.g. user zoomed past meaningful bounds), returns [].
 */
export function cellsForViewport(viewport: Viewport, resolution: number): string[] {
  const polygon = viewportToH3Polygon(viewport);
  try {
    return h3.polygonToCells(polygon, resolution);
  } catch {
    return [];
  }
}

/**
 * Privacy primitive: snap a precise (lat, lng) to the centroid of its H3 cell
 * at the given resolution. Defaults to r10 (~120m across).
 *
 * Called at WRITE time on the backend before persisting a user's location,
 * and never reversed. Other users only ever see the snapped coordinate.
 */
export function fuzzLocation(
  point: LatLng,
  resolution = 10,
): LatLng {
  const cell = h3.latLngToCell(point.lat, point.lng, resolution);
  const [lat, lng] = h3.cellToLatLng(cell);
  return { lat, lng };
}

/** Haversine distance in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
