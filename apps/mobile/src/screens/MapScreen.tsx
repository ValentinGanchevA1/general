import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	InteractionManager,
	StyleSheet,
	Text,
	View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import MapView, {
	PROVIDER_GOOGLE,
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
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { colors } from '@/theme';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { MapCoachMarks } from '@/components/map/MapCoachMarks';
import {
	ListingModeFilter,
	type ListingModeFilterValue,
} from '@/components/map/ListingModeFilter';
import { EmptyState } from '@/components/EmptyState';
import { MapChrome } from '@/components/map/MapChrome';
import { CreateNearbySheet } from '@/components/map/CreateNearbySheet';
import { useCreateNearby } from '@/features/map/useCreateNearby';
import { useMapFocus } from '@/features/map/useMapFocus';
import { sheetChrome, useSheetBackdrop } from '@/components/sheets';
import { mapListingModeFilterTop } from '@/components/map/mapChromeLayout';

const EMPTY_POINTS: DiscoveryPoint[] = [];

export function MapScreen(): React.JSX.Element {
	const dispatch = useAppDispatch();
	const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
	const route = useRoute<RouteProp<TabParamList, 'Map'>>();
	const { coords: myCoords, requestPermission } = useUserLocation();
	const [region, setRegion] = useState<Region | null>(null);
	const [selected, setSelected] = useState<EntityPoint | null>(null);
	const [waving, setWaving] = useState<string | null>(null);
	const mapRef = useRef<MapView>(null);
	const entitySheetRef = useRef<BottomSheetModal>(null);
	const presentedIdRef = useRef<string | null>(null);
	const entitySnapPoints = useMemo(() => ['36%', '62%'], []);
	const renderBackdrop = useSheetBackdrop(0.5);
	const { unreadCount: interactionUnread } = useReceivedInteractions();

	const [listingModeFilter, setListingModeFilter] =
		useState<ListingModeFilterValue>('all');
	const insets = useSafeAreaInsets();

	const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
	const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);
	const listingMode =
		listingModeFilter === 'all' ? undefined : listingModeFilter;

	const { data, loading } = useDiscovery({
		viewport,
		zoom,
		listingMode,
	});
	const points = data?.points ?? EMPTY_POINTS;

	const {
		createNearbyOpen,
		setCreateNearbyOpen,
		onMapLongPress,
		onCreateNearbySelect,
	} = useCreateNearby(navigation, selected != null);

	useMapFocus({
		mapRef,
		myCoords,
		points: points.filter(
			(p): p is EntityPoint => p.kind === 'user' || p.kind === 'event' || p.kind === 'listing',
		),
		region,
		setSelected,
		setListingModeFilter,
		navigation,
		params: {
			focusMyPin: route.params?.focusMyPin === true,
			...(route.params?.focusUserId != null ? { focusUserId: route.params.focusUserId } : {}),
			...(route.params?.focusListingId != null
				? { focusListingId: route.params.focusListingId }
				: {}),
			...(route.params?.focusLat != null ? { focusLat: route.params.focusLat } : {}),
			...(route.params?.focusLng != null ? { focusLng: route.params.focusLng } : {}),
		},
	});

	const onCloseSheet = useCallback(() => {
		presentedIdRef.current = null;
		entitySheetRef.current?.dismiss();
		setSelected(null);
	}, []);

	const onEntityPress = useCallback((point: EntityPoint) => {
		setSelected(point);
	}, []);

	useEffect(() => {
		if (!selected) {
			presentedIdRef.current = null;
			return;
		}
		const id = `${selected.kind}:${selected.id}`;
		if (presentedIdRef.current === id) return;
		const task = InteractionManager.runAfterInteractions(() => {
			presentedIdRef.current = id;
			try {
				entitySheetRef.current?.present();
			} catch (e) {
				if (__DEV__) console.warn('entity sheet present failed', e);
				presentedIdRef.current = null;
			}
		});
		return () => task.cancel();
	}, [selected]);

	useEffect(() => {
		dispatch(setPoints(points));
	}, [points, dispatch]);

	useEffect(() => {
		const uris: Array<string | null> = [];
		for (const p of points) {
			if (p.kind === 'user') uris.push(p.meta.avatarUrl);
			else if (p.kind === 'event') uris.push(p.meta.coverUrl);
			else if (p.kind === 'listing') uris.push(p.meta.thumbnailUrl);
		}
		prefetchAvatars(uris);
	}, [points]);

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

	useEffect(() => {
		if (!viewport) return;
		const t = setTimeout(() => {
			void dispatch(fetchNearbyStories({ viewport, zoom }));
		}, 350);
		return () => clearTimeout(t);
	}, [viewport, zoom, dispatch]);

	useEffect(() => {
		return on('story:new', (e) => {
			dispatch(storyReceived(e));
		});
	}, [on, dispatch]);

	const onClusterPress = useCallback(
		(c: ClusterPoint) => {
			mapRef.current?.animateToRegion(
				{
					latitude: c.lat,
					longitude: c.lng,
					latitudeDelta: Math.max(0.005, (region?.latitudeDelta ?? 0.05) / 2.5),
					longitudeDelta: Math.max(0.005, (region?.longitudeDelta ?? 0.05) / 2.5),
				},
				300,
			);
		},
		[region?.latitudeDelta, region?.longitudeDelta],
	);

	const onWave = useCallback(
		async (toUserId: string) => {
			setWaving(toUserId);
			try {
				const res = await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
					toUserId,
					context: 'map',
				});
				challengeEvents.emit('progress');
				if (res.conversationId) {
					appAlert('Match!', 'You both waved — say hi.');
				}
			} catch (e) {
				const msg =
					e && typeof e === 'object' && 'message' in e
						? String((e as ApiError).message)
						: 'Could not send wave.';
				appAlert('Wave failed', msg);
			} finally {
				setWaving(null);
			}
		},
		[],
	);

	const onSheetWavePress = useCallback(
		(userId: string) => {
			void onWave(userId);
		},
		[onWave],
	);

	const sheetOpen = selected != null;

	return (
		<View style={styles.root}>
			<ErrorBoundary fallback={<MapUnavailableFallback />}>
				<MapView
					ref={mapRef}
					provider={PROVIDER_GOOGLE}
					customMapStyle={MAP_STYLE}
					style={StyleSheet.absoluteFill}
					onRegionChangeComplete={setRegion}
					onLongPress={onMapLongPress}
					showsUserLocation
					showsMyLocationButton={false}
					showsCompass={false}
					toolbarEnabled={false}
				>
					<MapMarkers
						points={points}
						onEntityPress={onEntityPress}
						onClusterPress={onClusterPress}
					/>
				</MapView>
			</ErrorBoundary>

			<MapChrome
				interactionUnread={interactionUnread}
				onPressInteractions={() => openRootScreen(navigation, 'Interactions')}
				sheetOpen={sheetOpen}
			/>

			{region ? (
				<ListingModeFilter
					value={listingModeFilter}
					onChange={setListingModeFilter}
					top={mapListingModeFilterTop(insets.top)}
				/>
			) : null}

			{!loading && points.length === 0 && region ? (
				<View style={styles.emptyWrap} pointerEvents="none">
					<EmptyState
						variant="plain"
						icon="map-marker-radius-outline"
						title="Nothing nearby"
						body="Pan the map or long-press to create something here."
					/>
				</View>
			) : null}

			{loading && points.length === 0 ? (
				<View style={styles.loadingWrap} pointerEvents="none">
					<ActivityIndicator color={colors.primary} />
				</View>
			) : null}

			<EventsRail location={myCoords} />
			<MapCoachMarks mapReady={region != null} />

			<BottomSheetModal
				ref={entitySheetRef}
				snapPoints={entitySnapPoints}
				enablePanDownToClose
				onDismiss={onCloseSheet}
				backdropComponent={renderBackdrop}
				backgroundStyle={sheetChrome.background}
				handleIndicatorStyle={sheetChrome.handle}
			>
				<BottomSheetView style={sheetChrome.content}>
					{selected ? (
						<ErrorBoundary fallback={<Text style={styles.sheetError}>Could not load card</Text>}>
							<EntityBottomSheet
								point={selected}
								waving={selected.kind === 'user' && waving === selected.id}
								onClose={onCloseSheet}
								{...(selected.kind === 'user'
									? { onWave: () => onSheetWavePress(selected.id) }
									: {})}
							/>
						</ErrorBoundary>
					) : null}
				</BottomSheetView>
			</BottomSheetModal>

			<CreateNearbySheet
				visible={createNearbyOpen}
				onClose={() => setCreateNearbyOpen(false)}
				onSelect={onCreateNearbySelect}
			/>
		</View>
	);
}

function MapUnavailableFallback(): React.JSX.Element {
	return (
		<View style={[StyleSheet.absoluteFill, styles.unavailable]}>
			<Text style={styles.unavailableTitle}>Map unavailable</Text>
			<Text style={styles.unavailableBody}>
				Google Maps could not be initialized. Verify your API key in local.properties.
			</Text>
		</View>
	);
}

function regionToViewport(r: Region | null): Viewport | null {
	if (!r) return null;
	const halfLat = r.latitudeDelta / 2;
	const halfLng = r.longitudeDelta / 2;
	return {
		ne: { lat: r.latitude + halfLat, lng: r.longitude + halfLng },
		sw: { lat: r.latitude - halfLat, lng: r.longitude - halfLng },
	};
}

function approxZoomFromRegion(r: Region): number {
	const latDelta = Math.max(r.latitudeDelta, 0.0001);
	return Math.round(Math.log(360 / latDelta) / Math.LN2);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	emptyWrap: {
		position: 'absolute',
		left: 24,
		right: 24,
		bottom: 120,
		alignItems: 'center',
	},
	loadingWrap: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center',
	},
	sheetError: { color: colors.danger, padding: 16 },
	unavailable: {
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.bg,
		padding: 24,
	},
	unavailableTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
	unavailableBody: { color: colors.textMuted, marginTop: 8, textAlign: 'center' },
});
