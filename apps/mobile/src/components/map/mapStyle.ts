/**
 * Branded Google Maps styles. POI labels/icons stay hidden in both schemes so
 * NEXA entities remain the primary interactive layer.
 */
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0a0a0f' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b7b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0a0a0f' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1a1a24' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a9a' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a9a' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#6b6b7b' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#0e0e16' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#12121f' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#0c0c14' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' as const }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#0f1410' }, { visibility: 'on' as const }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' as const }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#1a1a28' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0a0a0f' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#5c5c6e' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#1e1e30' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2a2a40' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#0a0a0f' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#7a7a8c' }] },
  { featureType: 'road.local', elementType: 'geometry', stylers: [{ color: '#161622' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#14141e' }] },
  { featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: 'off' as const }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0a1520' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3a4a5a' }] },
];

export const LIGHT_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#f5f6f8' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#555866' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#ffffff' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#d8dae1' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#343640' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#f4f5f7' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#f0f3ef' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' as const }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#e5eee4' }, { visibility: 'on' as const }] },
  { featureType: 'poi.park', elementType: 'labels', stylers: [{ visibility: 'off' as const }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e1e3e8' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#686b77' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#e9e4dc' }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: '#d8d3cb' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#e8e9ed' }] },
  { featureType: 'transit.station', elementType: 'labels', stylers: [{ visibility: 'off' as const }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeaf3' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#668394' }] },
];

/** @deprecated Use DARK_MAP_STYLE or LIGHT_MAP_STYLE based on the resolved app scheme. */
export const MAP_STYLE = DARK_MAP_STYLE;
