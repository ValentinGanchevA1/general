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
	CategoryFilterBar,
	type ListingModeFilterValue,
} from '@/components/map/CategoryFilterBar';
import { EmptyState } from '@/components/EmptyState';
import { MapChrome } from '@/components/map/MapChrome';
import { MapSearchBar } from '@/components/map/MapSearchBar';
import { TrendingCard } from '@/components/map/TrendingCard';
import {
	buildTrending,
	type TrendingItem,
} from '@/components/map/buildTrending';
import { CreateNearbySheet } from '@/components/map/CreateNearbySheet';
import { useCreateNearby } from '@/features/map/useCreateNearby';
import { useMapFocus } from '@/features/map/useMapFocus';
import { useMapCreateNudge } from '@/features/map/useMapCreateNudge';
import { MapCreateNudgeBanner } from '@/features/map/MapCreateNudgeBanner';
import { sheetChrome, useSheetBackdrop } from '@/components/sheets';
import {
	LISTING_MODE_FILTER_HEIGHT,
	MAP_CHROME_GAP,
	mapListingModeFilterTop,
	mapSearchBarTop,
} from '@/components/map/mapChromeLayout';

const EMPTY_POINTS: DiscoveryPoint[] = [];


type MapEmptyActionKind = 'show_everyone' | 'create';

function mapEmptyCopy(opts: {
	friendsOnly: boolean;
	listingMode: ListingModeFilterValue;
}): {
	icon: string;
	title: string;
	body: string;
	actionLabel: string;
	actionKind: MapEmptyActionKind;
} {
	if (opts.friendsOnly) {
		return {
			icon: 'account-group-outline',
			title: 'No friends nearby',
			body: 'None of your friends are in this area right now. Pan the map or turn Friends off.',
			actionLabel: 'Show everyone',
			actionKind: 'show_everyone',
		};
	}
	if (opts.listingMode === 'sell') {
		return {
			icon: 'tag-outline',
			title: 'No for-sale listings here',
			body: 'Nothing for sale in this area. Post one, or switch the filter to All.',
			actionLabel: 'Create here',
			actionKind: 'create',
		};
	}
	if (opts.listingMode === 'buy') {
		return {
			icon: 'cart-outline',
			title: 'No wanted posts here',
			body: 'Nobody is looking to buy in this area yet. Post a wanted, or switch the filter to All.',
			actionLabel: 'Create here',
			actionKind: 'create',
		};
	}
	return {
		icon: 'map-marker-radius-outline',
		title: 'Nothing nearby yet',
		body: 'Be the first — sell something, post a wanted, create an event, or drop a local alert. Long-press the map anytime.',
		actionLabel: 'Create here',
		actionKind: 'create',
	};
}

export function MapScreen(): React.JSX.Element {
	const dispatch = useAppDispatch();
	const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
	const route = useRoute<RouteProp<TabParamList, 'Map'>>();
	const { coords: myCoords, requestPermission } = useUserLocation();
	const [region, setRegion] = useState<Region | null>(null);
	const [selected, setSelected] = useState<EntityPoint | null>(null);
	const [waveToast, setWaveToast] = useState<string | null>(null);
	const [waving, setWaving] = useState<string | null>(null);
	const mapRef = useRef<MapView>(null);
	const entitySheetRef = useRef<BottomSheetModal>(null);
	const presentedIdRef = useRef<string | null>(null);
	const entitySnapPoints = useMemo(() => ['36%', '62%'], []);
	const renderBackdrop = useSheetBackdrop(0.5);
	const { unreadCount: interactionUnread } = useReceivedInteractions();

	const [listingModeFilter, setListingModeFilter] =
		useState<ListingModeFilterValue>('all');
	const [friendsOnly, setFriendsOnly] = useState(false);
	const [searchQuery, setSearchQuery] = useState('');
	const insets = useSafeAreaInsets();

	const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
	const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);
	const listingMode =
		listingModeFilter === 'all' ? undefined : listingModeFilter;

	const { data, loading } = useDiscovery({
		viewport,
		zoom,
		listingMode: friendsOnly ? undefined : listingMode,
		friendsOnly,
	});
	const points = data?.points ?? EMPTY_POINTS;

	const filteredPoints = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return points;
		return points.filter((p) => {
			if (p.kind === 'cluster') return true;
			if (p.kind === 'user') {
				return p.meta.displayName.toLowerCase().includes(q);
			}
			if (p.kind === 'event' || p.kind === 'listing') {
				return p.meta.title.toLowerCase().includes(q);
			}
			return false;
		});
	}, [points, searchQuery]);

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

	/** onDismiss only — sheet is already closing; do NOT call dismiss() again (sticks modal). */
	const onSheetDismiss = useCallback(() => {
		presentedIdRef.current = null;
		setSelected(null);
	}, []);

	/** Programmatic close (X / Wave navigate): animate dismiss; onSheetDismiss clears state. */
	const closeSheet = useCallback(() => {
		entitySheetRef.current?.dismiss();
	}, []);

	const onEntityPress = useCallback((point: EntityPoint) => {
		const id = `${point.kind}:${point.id}`;
		// Clear the "already presented" gate so a re-tap after dismiss always presents.
		// (onSheetDismiss also clears this; this covers the race where present was a no-op.)
		if (presentedIdRef.current !== id) {
			presentedIdRef.current = null;
		}
		setSelected(point);
		// Present on every marker press. Same-id while already open → present() no-op, content updates.
		InteractionManager.runAfterInteractions(() => {
			try {
				entitySheetRef.current?.present();
				presentedIdRef.current = id;
			} catch (e) {
				if (__DEV__) console.warn('entity sheet present failed', e);
				presentedIdRef.current = null;
			}
		});
	}, []);

	// When selection is set from focus (useMapFocus) rather than a marker press, still present.
	useEffect(() => {
		if (!selected) {
			presentedIdRef.current = null;
			return;
		}
		const id = `${selected.kind}:${selected.id}`;
		if (presentedIdRef.current === id) return;
		const task = InteractionManager.runAfterInteractions(() => {
			try {
				entitySheetRef.current?.present();
				presentedIdRef.current = id;
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

	// Depend on primitive lat/lng so GPS object identity churn does not reset the 30s interval.
	const myLat = myCoords?.lat;
	const myLng = myCoords?.lng;
	useEffect(() => {
		if (myLat == null || myLng == null) return;
		const location = { lat: myLat, lng: myLng };
		void sendPresence({ location });
		const t = setInterval(() => {
			void sendPresence({ location });
		}, 30_000);
		return () => clearInterval(t);
	}, [myLat, myLng, sendPresence]);

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
				} else {
					setWaveToast('Wave sent');
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

	useEffect(() => {
		if (!waveToast) return;
		const t = setTimeout(() => setWaveToast(null), 2200);
		return () => clearTimeout(t);
	}, [waveToast]);

	const sheetOpen = selected != null;
	// Continent-scale default region is not a real "empty nearby" — only city-ish
	// deltas count so we don't stack empty + nudge over Europe/Africa.
	const isCityScale =
		region != null &&
		region.latitudeDelta > 0 &&
		region.latitudeDelta <= 0.25 &&
		region.longitudeDelta > 0 &&
		region.longitudeDelta <= 0.25;
	const isEmpty = !loading && points.length === 0 && isCityScale;

	const trendingItems = useMemo(
		() => buildTrending(points, myLat, myLng, 3),
		[points, myLat, myLng],
	);

	const onTrendingPress = useCallback(
		(item: TrendingItem) => {
			onEntityPress(item.point);
		},
		[onEntityPress],
	);

	const trendingTop =
		mapListingModeFilterTop(insets.top) +
		LISTING_MODE_FILTER_HEIGHT +
		MAP_CHROME_GAP;

	const openCreateNearby = useCallback(() => {
		setCreateNearbyOpen(true);
	}, [setCreateNearbyOpen]);

	const { visible: createNudgeVisible, dismiss: dismissCreateNudge } = useMapCreateNudge({
		mapReady: region != null,
		isEmpty,
		blocked: sheetOpen || createNearbyOpen,
	});

	const onCreateNudgeCreate = useCallback(() => {
		dismissCreateNudge('create');
		openCreateNearby();
	}, [dismissCreateNudge, openCreateNearby]);

	const emptyCopy = mapEmptyCopy({
		friendsOnly,
		listingMode: listingModeFilter,
	});

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
						points={filteredPoints}
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
				<MapSearchBar
					value={searchQuery}
					onChangeText={setSearchQuery}
					top={mapSearchBarTop(insets.top)}
				/>
			) : null}

			{region ? (
				<CategoryFilterBar
					listingMode={listingModeFilter}
					onListingModeChange={setListingModeFilter}
					friendsOnly={friendsOnly}
					onFriendsOnlyChange={setFriendsOnly}
					top={mapListingModeFilterTop(insets.top)}
					showListingMode={!friendsOnly}
				/>
			) : null}

			<TrendingCard
				items={trendingItems}
				onPressItem={onTrendingPress}
				top={trendingTop}
				visible={isCityScale && !sheetOpen && !isEmpty}
			/>

			{isEmpty && !createNudgeVisible ? (
				<View style={styles.emptyWrap} pointerEvents="box-none">
					<EmptyState
						variant="card"
						icon={emptyCopy.icon}
						title={emptyCopy.title}
						body={emptyCopy.body}
						actionLabel={emptyCopy.actionLabel}
						onAction={
							emptyCopy.actionKind === 'show_everyone'
								? () => setFriendsOnly(false)
								: openCreateNearby
						}
					/>
				</View>
			) : null}

			{loading && points.length === 0 ? (
				<View style={styles.loadingWrap} pointerEvents="none">
					<ActivityIndicator color={colors.primary} />
				</View>
			) : null}

			{createNudgeVisible ? (
				<MapCreateNudgeBanner
					onCreate={onCreateNudgeCreate}
					onDismiss={() => dismissCreateNudge('dismiss')}
				/>
			) : null}

			<EventsRail location={myCoords} />
			<MapCoachMarks mapReady={region != null} />

			<BottomSheetModal
				ref={entitySheetRef}
				snapPoints={entitySnapPoints}
				enablePanDownToClose
				onDismiss={onSheetDismiss}
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
								onClose={closeSheet}
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

			{waveToast ? (
				<View
					style={[styles.waveToast, { top: insets.top + 12 }]}
					pointerEvents="none"
					accessibilityLiveRegion="polite"
				>
					<Text style={styles.waveToastText}>{waveToast}</Text>
				</View>
			) : null}
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
	waveToast: {
		position: 'absolute',
		alignSelf: 'center',
		backgroundColor: colors.surface,
		borderWidth: 1,
		borderColor: colors.border,
		borderRadius: 20,
		paddingHorizontal: 16,
		paddingVertical: 10,
		zIndex: 50,
		elevation: 6,
		shadowColor: '#000',
		shadowOpacity: 0.25,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 2 },
	},
	waveToastText: {
		color: colors.textPrimary,
		fontSize: 14,
		fontWeight: '600',
	},
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
