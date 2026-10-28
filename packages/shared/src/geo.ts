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
 * Hard safety budget for a single viewport H3 enumeration.
 *
 * This belongs in shared geo rather than individual services so every present
 * and future caller is protected before `polygonToCells` can materialize an
 * attacker-controlled, very large array in process memory.
 */
export const MAX_VIEWPORT_CELLS = 5_000;

/**
 * Refuse conservatively before the estimate reaches the post-enumeration cap.
 * H3 cells are hexagons and the viewport area estimate is deliberately simple,
 * so the margin leaves room for boundary/intersection effects.
 */
export const VIEWPORT_CELL_ESTIMATE_MARGIN = 0.8;

const KM_PER_DEGREE = 111.32;

/** Average H3 hexagon area in km² by resolution (H3 4.x reference values). */
const H3_AVG_CELL_AREA_KM2: Readonly<Record<number, number>> = {
  0: 4_357_449.416078383,
  1: 609_788.441794133,
  2: 86_801.780398997,
  3: 12_393.434655088,
  4: 1_770.347654491,
  5: 252.903858182,
  6: 36.129062164,
  7: 5.16129336,
  8: 0.737327598,
  9: 0.105332513,
  10: 0.015047502,
  11: 0.002149643,
  12: 0.000307092,
  13: 0.00004387,
  14: 0.000006267,
  15: 0.000000895,
};

function isValidViewportCoordinate(point: LatLng): boolean {
  return (
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lng) &&
    point.lat >= -90 &&
    point.lat <= 90 &&
    point.lng >= -180 &&
    point.lng <= 180
  );
}

function longitudeSpanDegrees(swLng: number, neLng: number): number {
  const raw = neLng - swLng;
  if (!Number.isFinite(raw)) return Number.POSITIVE_INFINITY;

  // Preserve an exact world-width viewport instead of normalizing 360° to 0°.
  if (Math.abs(raw) >= 360) return 360;

  // A negative span means the viewport crosses the antimeridian.
  return raw >= 0 ? raw : raw + 360;
}

/**
 * Conservative upper estimate of H3 cells intersecting a viewport.
 *
 * The longitude width uses the latitude in the viewport closest to the equator,
 * where a degree of longitude is widest. This intentionally overestimates
 * high-latitude viewports instead of underestimating them and risking OOM.
 * Invalid inputs or unsupported resolutions fail closed with +Infinity.
 */
export function estimateViewportCellCount(viewport: Viewport, resolution: number): number {
  if (!isValidViewportCoordinate(viewport.ne) || !isValidViewportCoordinate(viewport.sw)) {
    return Number.POSITIVE_INFINITY;
  }

  const cellAreaKm2 = H3_AVG_CELL_AREA_KM2[resolution];
  if (!cellAreaKm2 || !Number.isFinite(cellAreaKm2) || cellAreaKm2 <= 0) {
    return Number.POSITIVE_INFINITY;
  }

  const south = Math.min(viewport.sw.lat, viewport.ne.lat);
  const north = Math.max(viewport.sw.lat, viewport.ne.lat);
  const latSpanDegrees = north - south;
  const lngSpanDegrees = longitudeSpanDegrees(viewport.sw.lng, viewport.ne.lng);

  if (!Number.isFinite(lngSpanDegrees)) return Number.POSITIVE_INFINITY;
  if (latSpanDegrees === 0 || lngSpanDegrees === 0) return 0;

  const closestAbsLatitude = south <= 0 && north >= 0
    ? 0
    : Math.min(Math.abs(south), Math.abs(north));
  const longitudeScale = Math.cos((closestAbsLatitude * Math.PI) / 180);
  const latKm = latSpanDegrees * KM_PER_DEGREE;
  const lngKm = lngSpanDegrees * KM_PER_DEGREE * longitudeScale;
  const areaKm2 = latKm * lngKm;

  if (!Number.isFinite(areaKm2) || areaKm2 < 0) return Number.POSITIVE_INFINITY;
  return Math.ceil(areaKm2 / cellAreaKm2);
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
 *
 * The estimate is checked before `polygonToCells` so oversized/untrusted map
 * viewports cannot allocate an unbounded H3 cell array. A second hard cap after
 * enumeration protects against estimator error. Degenerate/invalid/oversized
 * viewports fail closed with [].
 */
export function cellsForViewport(viewport: Viewport, resolution: number): string[] {
  const estimate = estimateViewportCellCount(viewport, resolution);
  if (estimate > MAX_VIEWPORT_CELLS * VIEWPORT_CELL_ESTIMATE_MARGIN) {
    return [];
  }

  const polygon = viewportToH3Polygon(viewport);
  try {
    const cells = h3.polygonToCells(polygon, resolution);
    return cells.length <= MAX_VIEWPORT_CELLS ? cells : [];
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

/** H3 cell values for all seven index resolutions stored on every location row. */
export interface H3Cells {
  r4: string;
  r5: string;
  r6: string;
  r7: string;
  r8: string;
  r9: string;
  r10: string;
}

/**
 * Compute all seven H3 index columns for a (lat, lng) pair.
 * Call this before every INSERT/UPDATE that sets a `location` column so that
 * location_h3_r4–r10 stay in sync.
 */
export function computeH3Cells(lat: number, lng: number): H3Cells {
  return {
    r4:  h3.latLngToCell(lat, lng, 4),
    r5:  h3.latLngToCell(lat, lng, 5),
    r6:  h3.latLngToCell(lat, lng, 6),
    r7:  h3.latLngToCell(lat, lng, 7),
    r8:  h3.latLngToCell(lat, lng, 8),
    r9:  h3.latLngToCell(lat, lng, 9),
    r10: h3.latLngToCell(lat, lng, 10),
  };
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
