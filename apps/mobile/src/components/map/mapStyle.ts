/**
 * Branded dark map style aligned to `colors.bg` (#0a0a0f).
 *
 * - Land / water / roads / transit geometry match the app shell
 * - Labels muted so entity markers stay primary
 * - POI icons + labels off (stock Google landmarks compete with G88 pins)
 *
 * Plain style array (no MapStyleElement import) for project-aware ESLint.
 */
export const MAP_STYLE = [
  // Base geometry
  {
    elementType: 'geometry',
    stylers: [{ color: '#0a0a0f' }],
  },
  {
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b6b7b' }],
  },
  {
    elementType: 'labels.text.stroke',
    stylers: [{ color: '#0a0a0f' }],
  },

  // Administrative
  {
    featureType: 'administrative',
    elementType: 'geometry',
    stylers: [{ color: '#1a1a24' }],
  },
  {
    featureType: 'administrative.country',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a8a9a' }],
  },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#8a8a9a' }],
  },
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#6b6b7b' }],
  },

  // Landscape
  {
    featureType: 'landscape',
    elementType: 'geometry',
    stylers: [{ color: '#0e0e16' }],
  },
  {
    featureType: 'landscape.man_made',
    elementType: 'geometry',
    stylers: [{ color: '#12121f' }],
  },
  {
    featureType: 'landscape.natural',
    elementType: 'geometry',
    stylers: [{ color: '#0c0c14' }],
  },

  // POI — hide icons/labels so only G88 markers compete
  {
    featureType: 'poi',
    stylers: [{ visibility: 'off' as const }],
  },
  {
    featureType: 'poi.park',
    elementType: 'geometry',
    stylers: [{ color: '#0f1410' }, { visibility: 'on' as const }],
  },
  {
    featureType: 'poi.park',
    elementType: 'labels',
    stylers: [{ visibility: 'off' as const }],
  },

  // Roads
  {
    featureType: 'road',
    elementType: 'geometry.fill',
    stylers: [{ color: '#1a1a28' }],
  },
  {
    featureType: 'road',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0a0a0f' }],
  },
  {
    featureType: 'road',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#5c5c6e' }],
  },
  {
    featureType: 'road.arterial',
    elementType: 'geometry',
    stylers: [{ color: '#1e1e30' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#2a2a40' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry.stroke',
    stylers: [{ color: '#0a0a0f' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#7a7a8c' }],
  },
  {
    featureType: 'road.local',
    elementType: 'geometry',
    stylers: [{ color: '#161622' }],
  },

  // Transit — muted, no icons
  {
    featureType: 'transit',
    elementType: 'geometry',
    stylers: [{ color: '#14141e' }],
  },
  {
    featureType: 'transit.station',
    elementType: 'labels',
    stylers: [{ visibility: 'off' as const }],
  },

  // Water
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#0a1520' }],
  },
  {
    featureType: 'water',
    elementType: 'labels.text.fill',
    stylers: [{ color: '#3a4a5a' }],
  },
];
