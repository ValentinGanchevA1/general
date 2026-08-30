/**
 * Provider-agnostic camera/region focus for "View on map" and peer pins.
 * - buildPeerRegionFocus → react-native-maps (current)
 * - buildPeerCameraFocus → @rnmapbox/maps (migration-ready)
 */

export type FocusPeerArgs = {
  lat: number;
  lng: number;
  /** Prefer shorter ease for local peers; longer / wider for far jumps */
  distanceMeters?: number;
  /** Extra bottom padding when entity sheet is open (Mapbox padding) */
  sheetOpen?: boolean;
};

/** Threshold: beyond this, treat as a long hop (wider zoom, longer anim). */
const FAR_METERS = 5_000;

export type PeerRegionFocus = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
  duration: number;
};

/** react-native-maps Region + duration (what MapScreen uses today). */
export function buildPeerRegionFocus({
  lat,
  lng,
  distanceMeters,
}: FocusPeerArgs): PeerRegionFocus {
  const far = distanceMeters != null && distanceMeters > FAR_METERS;
  const delta = far ? 0.04 : 0.015;
  return {
    latitude: lat,
    longitude: lng,
    latitudeDelta: delta,
    longitudeDelta: delta,
    duration: far ? 900 : 450,
  };
}

export type PeerCameraFocus = {
  /** Mapbox order: [longitude, latitude] */
  centerCoordinate: [number, number];
  zoomLevel: number;
  animationDuration: number;
  animationMode: 'easeTo' | 'flyTo';
  padding: {
    paddingTop: number;
    paddingRight: number;
    paddingBottom: number;
    paddingLeft: number;
  };
};

/** @rnmapbox/maps Camera stop — unused until provider switch. */
export function buildPeerCameraFocus({
  lat,
  lng,
  distanceMeters,
  sheetOpen = false,
}: FocusPeerArgs): PeerCameraFocus {
  const far = distanceMeters != null && distanceMeters > FAR_METERS;
  return {
    centerCoordinate: [lng, lat],
    zoomLevel: far ? 13.5 : 14.5,
    animationDuration: far ? 900 : 450,
    animationMode: far ? 'flyTo' : 'easeTo',
    padding: {
      paddingTop: 40,
      paddingRight: 24,
      paddingLeft: 24,
      paddingBottom: sheetOpen ? 280 : 80,
    },
  };
}

/** Rough great-circle distance (meters) for near/far focus choice. */
export function approxDistanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}
