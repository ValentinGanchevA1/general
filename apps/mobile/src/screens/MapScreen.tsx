import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	InteractionManager,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

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
	DiscoveryRankBy,
	EntityKind,
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
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useUserLocation } from '@/features/location/useUserLocation';
import { MapMarkers } from '@/components/map/MapMarkers';
import { prefetchAvatars } from '@/services/avatarCache';
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { challengeEvents } from '@/features/gamification/challengeEvents';
import { signalPostSocialActivation } from '@/features/nudges/postSocialActivation';
import { EventsRail } from '@/features/events/EventsRail';
import {
	fetchNearbyStories,
	storyReceived,
} from '@/features/stories/storiesSlice';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { colors } from '@/theme';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { MapCoachMarks } from '@/components/map/MapCoachMarks';
import {
	MapFilterRow,
	DEFAULT_MAP_LAYERS,
	type ListingModeFilterValue,
} from '@/components/map/MapFilterRow';
import { EmptyState } from '@/components/EmptyState';
import { mapEmptyCopy } from '@/components/map/mapEmptyCopy';
import { MapChrome } from '@/components/map/MapChrome';
import { TrendingCard } from '@/components/map/TrendingCard';
import {
	buildTrending,
	type TrendingItem,
} from '@/components/map/buildTrending';
import { CreateNearbySheet } from '@/components/map/CreateNearbySheet';
import { useCreateNearby } from '@/features/map/useCreateNearby';
import { useMapFocus } from '@/features/map/useMapFocus';
import { useMapCreateNudge } from '@/features/map/useMapCreateNudge';
import {
	countUnseen,
	loadSeenKeys,
	mergeSeen,
	saveSeenKeys,
	isEntityPoint,
	entityPointKey,
} from '@/features/map/mapNovelty';
import { clearMapNewCount, setMapNewCount } from '@/features/map/mapNoveltySlice';
import { MapCreateNudgeBanner } from '@/features/map/MapCreateNudgeBanner';
import { sheetChrome, useSheetBackdrop } from '@/components/sheets';
import {
	mapFabBottom,
	mapFilterRowTop,
	mapTrendingTop,
	type MapTopStackVisibility,
} from '@/components/map/mapChromeLayout';
import { useNudges } from '@/features/nudges/useNudges';
import { useChallenges } from '@/features/gamification/useChallenges';

const EMPTY_POINTS: DiscoveryPoint[] = [];

export function MapScreen(): React.JSX.Element {
	const dispatch = useAppDispatch();
	const emailVerified =
		useAppSelector((s) => s.profile.profile?.badges?.email === true);
	const openToDating =
		useAppSelector((s) => s.profile.profile?.openToDating === true);
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
	const [layers, setLayers] = useState<EntityKind[]>(DEFAULT_MAP_LAYERS);
	const [friendsOnly, setFriendsOnly] = useState(false);
	const [datingOnly, setDatingOnly] = useState(false);
	const [rankBy, setRankBy] = useState<DiscoveryRankBy>('relevance');
	const [searchQuery, setSearchQuery] = useState('');
	const [trendingCollapsed, setTrendingCollapsed] = useState(true);
	const insets = useSafeAreaInsets();

	const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
	const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);
	const listingMode =
		listingModeFilter === 'all' ? undefined : listingModeFilter;

	const kinds = layers.length > 0 ? layers : DEFAULT_MAP_LAYERS;
	const peopleLayer = kinds.includes('user');
	const listingsLayer = kinds.includes('listing');

	const { data, loading, refresh: refreshDiscovery } = useDiscovery({
		viewport,
		zoom,
		kinds,
		listingMode: peopleLayer && (friendsOnly || datingOnly) ? undefined : listingsLayer ? listingMode : undefined,
		friendsOnly: peopleLayer && friendsOnly,
		datingOnly: peopleLayer && datingOnly && !friendsOnly,
		rankBy,
	});
	const points = data?.points ?? EMPTY_POINTS;
	const mapFocused = useIsFocused();
	const seenKeysRef = useRef<Set<string>>(new Set());
	const [seenReady, setSeenReady] = useState(false);

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
		setRegion,
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

	const onSheetDismiss = useCallback(() => {
		presentedIdRef.current = null;
		setSelected(null);
	}, []);

	const closeSheet = useCallback(() => {
		entitySheetRef.current?.dismiss();
	}, []);

	const onEntityPress = useCallback((point: EntityPoint) => {
		const id = `${point.kind}:${point.id}`;
		if (presentedIdRef.current !== id) {
			presentedIdRef.current = null;
		}
		setSelected(point);
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

	const onWave = useCallback(async (toUserId: string) => {
		setWaving(toUserId);
		try {
			const res = await postJson<WaveRequest, WaveResponse>('/interactions/wave', {
				toUserId,
				context: 'map',
			});
			challengeEvents.emit('progress');
			void signalPostSocialActivation('wave');
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
	}, []);

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

	const { nudge } = useNudges();
	const { challenges } = useChallenges();
	const [challengeDismissed, setChallengeDismissed] = useState(false);
	/** First region settle does not count as a pan; subsequent moves dismiss daily challenge (session). */
	const regionSettledOnceRef = useRef(false);
	const lastRegionRef = useRef<Region | null>(null);

	const onRegionChangeComplete = useCallback(
		(next: Region) => {
			setRegion(next);
			if (!regionSettledOnceRef.current) {
				regionSettledOnceRef.current = true;
				lastRegionRef.current = next;
				return;
			}
			const prev = lastRegionRef.current;
			lastRegionRef.current = next;
			if (challengeDismissed || !prev) return;
			const moved =
				Math.abs(prev.latitude - next.latitude) > 0.0005 ||
				Math.abs(prev.longitude - next.longitude) > 0.0005 ||
				Math.abs(prev.latitudeDelta - next.latitudeDelta) > 0.01;
			if (moved) setChallengeDismissed(true);
		},
		[challengeDismissed],
	);

	const onRecenter = useCallback(() => {
		if (myCoords == null || mapRef.current == null) return;
		const latitudeDelta = region?.latitudeDelta ?? 0.04;
		const longitudeDelta = region?.longitudeDelta ?? 0.04;
		mapRef.current.animateToRegion(
			{
				latitude: myCoords.lat,
				longitude: myCoords.lng,
				latitudeDelta,
				longitudeDelta,
			},
			350,
		);
	}, [myCoords, region?.latitudeDelta, region?.longitudeDelta]);

	const topStack = useMemo<MapTopStackVisibility>(
		() => ({
			challengeVisible:
				!challengeDismissed && challenges.some((c) => !c.completed),
			nudgeVisible: nudge != null,
		}),
		[challengeDismissed, challenges, nudge],
	);
	const filterRowTop = mapFilterRowTop(insets.top, sheetOpen, topStack);
	const trendingTop = mapTrendingTop(insets.top, sheetOpen, topStack);

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
		datingOnly,
		openToDating,
		listingMode: listingModeFilter,
		emailVerified,
	});

	// --- New near you (client seen-set + tab badge) ---
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			const seen = await loadSeenKeys();
			if (cancelled) return;
			seenKeysRef.current = seen;
			setSeenReady(true);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (!seenReady || loading) return;
		const seen = seenKeysRef.current;
		const entityKeys = points.filter(isEntityPoint).map(entityPointKey);
		const { count } = countUnseen(points, seen);
		if (mapFocused) {
			dispatch(clearMapNewCount());
			const t = setTimeout(() => {
				const merged = mergeSeen(seenKeysRef.current, entityKeys);
				seenKeysRef.current = merged;
				void saveSeenKeys(merged);
			}, 1200);
			return () => clearTimeout(t);
		}
		dispatch(setMapNewCount(count));
	}, [points, loading, mapFocused, seenReady, dispatch]);

	useEffect(() => {
		if (mapFocused || region == null) return;
		const t = setInterval(() => {
			refreshDiscovery();
		}, 60_000);
		return () => clearInterval(t);
	}, [mapFocused, region, refreshDiscovery]);

	return (
		<View style={styles.root}>
			<ErrorBoundary fallback={<MapUnavailableFallback />}>
				<MapView
					ref={mapRef}
					provider={PROVIDER_GOOGLE}
					customMapStyle={MAP_STYLE}
					style={StyleSheet.absoluteFill}
					onRegionChangeComplete={onRegionChangeComplete}
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
				topStack={topStack}
				onDismissChallenge={() => setChallengeDismissed(true)}
			/>

			{region ? (
				<MapFilterRow
					value={layers}
					onChange={setLayers}
					listingMode={listingModeFilter}
					onListingModeChange={setListingModeFilter}
					friendsOnly={friendsOnly}
					onFriendsOnlyChange={setFriendsOnly}
					datingOnly={datingOnly}
					onDatingOnlyChange={setDatingOnly}
					rankBy={rankBy}
					onRankByChange={setRankBy}
					searchQuery={searchQuery}
					onSearchQueryChange={setSearchQuery}
					top={filterRowTop}
					onCreatePress={openCreateNearby}
				/>
			) : null}

			<TrendingCard
				items={trendingItems}
				onPressItem={onTrendingPress}
				top={trendingTop}
				visible={
					isCityScale &&
					!sheetOpen &&
					!isEmpty &&
					searchQuery.trim() === ''
				}
				collapsed={trendingCollapsed}
				onToggleCollapse={() => setTrendingCollapsed((c) => !c)}
			/>

			{isEmpty && !createNudgeVisible && nudge == null ? (
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
								: emptyCopy.actionKind === 'clear_dating'
									? () => setDatingOnly(false)
									: emptyCopy.actionKind === 'dating_prefs'
										? () => openRootScreen(navigation, 'ProfileEdit')
										: emptyCopy.actionKind === 'verify_email'
											? () => openRootScreen(navigation, 'EmailVerification')
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
				onDismiss={onSheetDismiss}
				enablePanDownToClose
				backdropComponent={renderBackdrop}
				handleIndicatorStyle={sheetChrome.handleIndicator}
				backgroundStyle={sheetChrome.background}
			>
				<BottomSheetView style={sheetChrome.content}>
					{selected ? (
						<EntityBottomSheet
							point={selected}
							waving={waving === selected.id}
							onClose={closeSheet}
							{...(selected.kind === 'user'
								? { onWave: onSheetWavePress }
								: {})}
						/>
					) : null}
				</BottomSheetView>
			</BottomSheetModal>

			{waveToast ? (
				<View style={styles.toast} pointerEvents="none">
					<Text style={styles.toastText}>{waveToast}</Text>
				</View>
			) : null}

			{/* Recenter FAB */}
			{myCoords != null ? (
				<Pressable
					style={[styles.recenterFab, { bottom: mapFabBottom(sheetOpen) }]}
					onPress={onRecenter}
					accessibilityRole="button"
					accessibilityLabel="Recenter map on me"
				>
					<Icon name="crosshairs-gps" size={22} color={colors.textPrimary} />
				</Pressable>
			) : null}

			<CreateNearbySheet
				open={createNearbyOpen}
				onClose={() => setCreateNearbyOpen(false)}
				onSelect={onCreateNearbySelect}
			/>
		</View>
	);
}

function MapUnavailableFallback(): React.JSX.Element {
	return (
		<View style={styles.unavailable}>
			<Text style={styles.unavailableTitle}>Map unavailable</Text>
			<Text style={styles.unavailableBody}>
				Something went wrong loading the map. Try again in a moment.
			</Text>
		</View>
	);
}

function regionToViewport(region: Region | null): Viewport | null {
	if (!region) return null;
	const halfLat = region.latitudeDelta / 2;
	const halfLng = region.longitudeDelta / 2;
	return {
		minLat: region.latitude - halfLat,
		maxLat: region.latitude + halfLat,
		minLng: region.longitude - halfLng,
		maxLng: region.longitude + halfLng,
	};
}

function approxZoomFromRegion(region: Region): number {
	const latDelta = Math.max(region.latitudeDelta, 0.0001);
	return Math.round(Math.log2(360 / latDelta));
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	emptyWrap: {
		...StyleSheet.absoluteFillObject,
		justifyContent: 'center',
		paddingHorizontal: 24,
	},
	loadingWrap: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center',
	},
	toast: {
		position: 'absolute',
		alignSelf: 'center',
		top: 120,
		backgroundColor: colors.surface,
		paddingHorizontal: 16,
		paddingVertical: 10,
		borderRadius: 20,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
	},
	toastText: { color: colors.textPrimary, fontWeight: '600', fontSize: 14 },
	recenterFab: {
		position: 'absolute',
		right: 16,
		width: 48,
		height: 48,
		borderRadius: 24,
		backgroundColor: colors.surface,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		elevation: 4,
	},
	unavailable: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		padding: 24,
	},
	unavailableTitle: { color: colors.textPrimary, fontSize: 18, fontWeight: '700' },
	unavailableBody: { color: colors.textMuted, marginTop: 8, textAlign: 'center' },
});
