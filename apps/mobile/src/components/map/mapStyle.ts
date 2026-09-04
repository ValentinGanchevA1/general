/**
 * Suppresses Google's native POI layer (business/landmark icons + labels —
 * museums, galleries, transit stops, etc.) so only G88's own entity and
 * cluster markers render on the map. Without this, stock Google POIs
 * visually compete with brand-colored markers and clash with the app's dark
 * theme.
 *
 * Audited 2026-09-04 (discovery cluster investigation).
 *
 * Typed as a plain style array (no MapStyleElement import) so project-aware
 * ESLint does not depend on react-native-maps type re-exports.
 */
export const MAP_STYLE = [
	{
		featureType: 'poi',
		stylers: [{ visibility: 'off' as const }],
	},
];
