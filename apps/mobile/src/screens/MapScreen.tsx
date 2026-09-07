import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	InteractionManager,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import MapView, {
	PROVIDER_GOOGLE,
	type LongPressEvent,
	type Region,
} from 'react-native-maps';
import { MAP_STYLE } from '@/components/map/mapStyle';
import {
	BottomSheetModal,
	BottomSheetView,
} from '@gorhom/bottom-sheet';

import type {
	ApiError,
	DiscoveryPoint,
	EntityPoint,
	ClusterPoint,
	Viewport,
	WaveRequest,
	WaveResponse,
} from '@g88/shared';

import { useDiscovery } from '@/features/discovery/useDiscovery';
import { setPoints } from '@/features/discovery/discoverySlice';
import { useSocket } from '@/realtime/useSocket';
import { postJson } from '@/api/client';
import { useAppDispatch } from '@/hooks/redux';
import { useUserLocation } from '@/features/location/useUserLocation';
import { MapMarkers } from '@/components/map/MapMarkers';
import { prefetchAvatars } from '@/services/avatarCache';
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { challengeEvents } from '@/features/gamification/challengeEvents';
import { EventsRail } from '@/features/events/EventsRail';
import {
	fetchNearbyStories,
	storyReceived,
} from '@/features/stories/storiesSlice';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import {
	clearPendingMapFocus,
	peekPendingMapFocus,
} from '@/navigation/pendingMapFocus';
import { track } from '@/lib/analytics';
import { colors } from '@/theme';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { MapCoachMarks } from '@/components/map/MapCoachMarks';
import {
	ListingModeFilter,
	type ListingModeFilterValue,
} from '@/components/map/ListingModeFilter';
import { EmptyState } from '@/components/EmptyState';
import { MapChrome } from '@/components/map/MapChrome';
import {
	CreateNearbySheet,
	type CreateNearbyAction,
} from '@/components/map/CreateNearbySheet';
import { sheetChrome, useSheetBackdrop } from '@/components/sheets';
import {
	approxDistanceMeters,
	buildPeerRegionFocus,
} from '@/components/map/focusPeerOnMap';
import { mapListingModeFilterTop } from '@/components/map/mapChromeLayout';

const EMPTY_POINTS: DiscoveryPoint[] = [];

export function MapScreen(): React.JSX.Element {
	const dispatch = useAppDispatch();
	const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
	const route = useRoute<RouteProp<TabParamList, 'Map'>>();
	const { coords: myCoords, requestPermission } = useUserLocation();
	const [region, setRegion] = useState<Region | null>(null);
	const [selected, setSelected] = useState<EntityPoint | null>(null);
	const mapRef = useRef<MapView>(null);
	const entitySheetRef = useRef<BottomSheetModal>(null);
	const entitySnapPoints = useMemo(() => ['36%', '62%'], []);
	const renderBackdrop = useSheetBackdrop(0.5);
	const { unreadCount: interactionUnread } = useReceivedInteractions();
	const [listingModeFilter, setListingModeFilter] =
		useState<ListingModeFilterValue>('all');
	const insets = useSafeAreaInsets();

	useEffect(() => {
		void requestPermission();
	}, [requestPermission]);

	const { sendPresence, on } = useSocket();

	useEffect(() => {
		if (!myCoords) return;
		void sendPresence({ location: myCoords });
		const t = setInterval(() => {
			if (myCoords) void sendPresence({ location: myCoords });
		}, 30_000);
		return () => clearInterval(t);
	}, [myCoords, sendPresence]);

	return (
		<View style={styles.root}>
			<MapView
				ref={mapRef}
				style={StyleSheet.absoluteFill}
				provider={PROVIDER_GOOGLE}
				customMapStyle={MAP_STYLE}
				showsUserLocation
				showsMyLocationButton={false}
				onRegionChangeComplete={setRegion}
			>
				<MapMarkers points={EMPTY_POINTS} onEntityPress={() => undefined} onClusterPress={() => undefined} />
			</MapView>
			<MapChrome
				sheetOpen={false}
				interactionUnread={interactionUnread}
				onPressInteractions={() => openRootScreen('Interactions')}
			/>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
});
