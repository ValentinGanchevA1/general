import { useCallback, useState } from 'react';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { MapCoordinate } from '@/features/map/contracts/mapRenderer';
import { track } from '@/lib/analytics';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import type { CreateNearbyKind } from '@/components/map/CreateNearbySheet';
import { setPendingCreateNearby } from '@/features/map/pendingCreateNearby';
import { trackMapLongPressCreate } from '@/features/map/mapLongPressAnalytics';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function useCreateNearby(navigation: Nav, blocked: boolean) {
	const [createNearbyOpen, setCreateNearbyOpen] = useState(false);
	const [createNearbyCoordinate, setCreateNearbyCoordinate] = useState<{
		lat: number;
		lng: number;
	} | null>(null);

	const onMapLongPress = useCallback(
		(coordinate: MapCoordinate) => {
			if (blocked) return;
			const { latitude, longitude } = coordinate;
			setCreateNearbyCoordinate({ lat: latitude, lng: longitude });
			setCreateNearbyOpen(true);
			trackMapLongPressCreate();
		},
		[blocked],
	);

	const onCreateNearbySelect = useCallback(
		(kind: CreateNearbyKind) => {
			const coords = createNearbyCoordinate;
			setCreateNearbyOpen(false);
			setCreateNearbyCoordinate(null);
			if (!coords) return;
			if (kind === 'event') {
				track('map.longpress_create_event');
				navigation.navigate('CreateEvent', {
					initialLat: coords.lat,
					initialLng: coords.lng,
				});
				return;
			}
			if (kind === 'listing') {
				track('map.longpress_create_listing');
				navigation.navigate('CreateListing', {
					initialLat: coords.lat,
					initialLng: coords.lng,
				});
				return;
			}
			track('map.longpress_create_post');
			setPendingCreateNearby({
				kind: 'post',
				lat: coords.lat,
				lng: coords.lng,
			});
			navigation.navigate('CreatePost');
		},
		[createNearbyCoordinate, navigation],
	);

	return {
		createNearbyOpen,
		setCreateNearbyOpen,
		onMapLongPress,
		onCreateNearbySelect,
	};
}
