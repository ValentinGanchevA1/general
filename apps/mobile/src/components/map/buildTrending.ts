// Client-only trending from current discovery points (Option 1).
// No backend aggregation — rank by distance + kind boost within the viewport set.

import type { DiscoveryPoint, EntityPoint } from '@g88/shared';

export interface TrendingItem {
	id: string;
	kind: EntityPoint['kind'];
	title: string;
	distanceM: number | null;
	score: number;
	/** Original entity for sheet open. */
	point: EntityPoint;
}

const EARTH_RADIUS_M = 6_371_000;

function haversineM(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const toRad = (d: number) => (d * Math.PI) / 180;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
	return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

const KIND_BOOST: Record<EntityPoint['kind'], number> = {
	event: 30,
	listing: 20,
	user: 0,
};

/**
 * Rank entities already in the viewport. Clusters are ignored.
 * Closer + event/listing boost → higher score. Returns at most `limit` items.
 */
export function buildTrending(
	points: DiscoveryPoint[],
	myLat: number | undefined,
	myLng: number | undefined,
	limit = 3,
): TrendingItem[] {
	const entities = points.filter(
		(p): p is EntityPoint =>
			p.kind === 'user' || p.kind === 'event' || p.kind === 'listing',
	);

	const ranked = entities.map((p) => {
		const title =
			p.kind === 'user' ? p.meta.displayName : p.meta.title;
		const distanceM =
			myLat != null && myLng != null
				? haversineM(myLat, myLng, p.lat, p.lng)
				: null;
		const distScore =
			distanceM == null ? 50 : Math.max(0, 100 - distanceM / 20);
		const score = distScore + KIND_BOOST[p.kind];
		return {
			id: p.id,
			kind: p.kind,
			title,
			distanceM,
			score,
			point: p,
		};
	});

	ranked.sort((a, b) => b.score - a.score);
	return ranked.slice(0, limit);
}

export function formatDistanceM(m: number | null): string {
	if (m == null) return '';
	if (m < 1000) return `${Math.round(m)}m`;
	return `${(m / 1000).toFixed(1)}km`;
}
