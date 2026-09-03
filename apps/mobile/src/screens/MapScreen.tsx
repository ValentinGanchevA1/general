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

const EMPTY_POINTS: DiscoveryPoint[] = [];

type PendingFocus = {
	userId?: string;
	lat?: number;
	lng?: number;
	displayName?: string;
	avatarUrl?: string | null;
	verification?: import('@g88/shared').VerificationLevel;
	online?: boolean;
	lastSeenAt?: string | null;
};

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
	const pendingFocusRef = useRef<PendingFocus | null>(null);
	const pendingFocusReaderRef = useRef<() => ReturnType<typeof peekPendingMapFocus>>(
		() => peekPendingMapFocus(),
	);
	const focusAppliedKeyRef = useRef<string | null>(null);
	const entitySnapPoints = useMemo(() => ['36%', '62%'], []);
	const renderBackdrop = useSheetBackdrop(0.5);
	const { unreadCount: interactionUnread } = useReceivedInteractions();
	const focusMyPin = route.params?.focusMyPin === true;
	const focusUserId = route.params?.focusUserId;
	const focusLat = route.params?.focusLat;
	const focusLng = route.params?.focusLng;

	const [createNearbyOpen, setCreateNearbyOpen] = useState(false);
	const [createNearbyCoords, setCreateNearbyCoords] = useState<{ lat: number; lng: number } | null>(null);

	const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
	const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);

	const { data, loading, error, refresh } = useDiscovery({ viewport, zoom });
	const points = data?.points ?? EMPTY_POINTS;

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

	const clearFocusParams = useCallback(() => {
		navigation.setParams({
			focusMyPin: undefined,
			focusUserId: undefined,
			focusLat: undefined,
			focusLng: undefined,
		} as never);
	}, [navigation]);

	const applyPeerFocus = useCallback(
		(lat: number, lng: number, point?: EntityPoint, token?: number) => {
			if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
			const distanceMeters =
				myCoords != null ? approxDistanceMeters(myCoords, { lat, lng }) : undefined;
			// exactOptionalPropertyTypes: omit key when undefined
			const { latitude, longitude, latitudeDelta, longitudeDelta, duration } =
				buildPeerRegionFocus({
					lat,
					lng,
					...(distanceMeters != null ? { distanceMeters } : {}),
				});
			InteractionManager.runAfterInteractions(() => {
				mapRef.current?.animateToRegion(
					{ latitude, longitude, latitudeDelta, longitudeDelta },
					duration,
				);
				// Open entity sheet like a marker tap (after camera starts moving).
				if (point) {
					setTimeout(() => setSelected(point), Math.min(duration, 350));
				}
			});
			pendingFocusRef.current = null;
			clearPendingMapFocus(token);
			clearFocusParams();
		},
		[clearFocusParams, myCoords],
	);

	const buildSeedUserPoint = useCallback(
		(
			userId: string,
			lat: number,
			lng: number,
			seed: PendingFocus | null,
			fromPoints?: EntityPoint & { kind: 'user' },
		): EntityPoint => {
			if (fromPoints) return fromPoints;
			return {
				kind: 'user',
				id: userId,
				lat,
				lng,
				meta: {
					displayName: seed?.displayName ?? 'User',
					avatarUrl: seed?.avatarUrl ?? null,
					verification: seed?.verification ?? 'none',
					online: seed?.online ?? false,
					lastSeenAt: seed?.lastSeenAt ?? null,
				},
			};
		},
		[],
	);

	const tryApplyPendingFocus = useCallback(() => {
		const mod = pendingFocusReaderRef.current();
		if (mod != null) {
			pendingFocusRef.current = {
				userId: mod.userId,
				...(mod.lat != null && mod.lng != null ? { lat: mod.lat, lng: mod.lng } : {}),
				...(mod.displayName != null ? { displayName: mod.displayName } : {}),
				...(mod.avatarUrl !== undefined ? { avatarUrl: mod.avatarUrl } : {}),
				...(mod.verification != null ? { verification: mod.verification } : {}),
				...(mod.online != null ? { online: mod.online } : {}),
				...(mod.lastSeenAt != null ? { lastSeenAt: mod.lastSeenAt } : {}),
			};
		}
		const pending = pendingFocusRef.current;
		if (!pending) return;

		const fromPoints =
			pending.userId != null
				? points.find(
					(p): p is EntityPoint & { kind: 'user' } =>
						p.kind === 'user' && p.id === pending.userId,
				)
				: undefined;

		const lat = pending.lat ?? fromPoints?.lat;
		const lng = pending.lng ?? fromPoints?.lng;
		if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
			// No coordinates yet — wait for discovery to surface the peer.
			return;
		}

		const key = `${pending.userId ?? ''}|${lat}|${lng}|${mod?.token ?? 0}`;
		if (focusAppliedKeyRef.current === key) return;
		focusAppliedKeyRef.current = key;

		const point =
			pending.userId != null
				? buildSeedUserPoint(pending.userId, lat, lng, pending, fromPoints)
				: fromPoints;

		applyPeerFocus(lat, lng, point, mod?.token);
	}, [points, applyPeerFocus, buildSeedUserPoint]);

	useEffect(() => {
		if (focusMyPin) return;
		const hasUser = focusUserId != null && focusUserId !== '';
		const hasCoords =
			focusLat != null &&
			focusLng != null &&
			Number.isFinite(focusLat) &&
			Number.isFinite(focusLng);
		if (!hasUser && !hasCoords) return;
		// Prefer module seed (has displayName etc.); merge route coords/userId.
		const mod = pendingFocusReaderRef.current();
		pendingFocusRef.current = {
			...(mod?.userId || hasUser
				? { userId: (hasUser ? focusUserId : mod?.userId) as string }
				: {}),
			...(hasCoords
				? { lat: focusLat as number, lng: focusLng as number }
				: mod?.lat != null && mod?.lng != null
					? { lat: mod.lat, lng: mod.lng }
					: {}),
			...(mod?.displayName != null ? { displayName: mod.displayName } : {}),
			...(mod?.avatarUrl !== undefined ? { avatarUrl: mod.avatarUrl } : {}),
			...(mod?.verification != null ? { verification: mod.verification } : {}),
			...(mod?.online != null ? { online: mod.online } : {}),
			...(mod?.lastSeenAt != null ? { lastSeenAt: mod.lastSeenAt } : {}),
		};
		focusAppliedKeyRef.current = null;
	}, [focusUserId, focusLat, focusLng, focusMyPin]);

	useEffect(() => {
		if (!myCoords || region) return;
		// Never steal the camera when a peer focus is in flight.
		if (focusMyPin || focusUserId || pendingFocusRef.current || pendingFocusReaderRef.current()) return;
		mapRef.current?.animateToRegion(
			{
				latitude: myCoords.lat,
				longitude: myCoords.lng,
				latitudeDelta: 0.02,
				longitudeDelta: 0.02,
			},
			400,
		);
	}, [myCoords, region, focusMyPin, focusUserId]);

	useFocusEffect(
		useCallback(() => {
			if (focusMyPin && myCoords) {
				mapRef.current?.animateToRegion(
					{
						latitude: myCoords.lat,
						longitude: myCoords.lng,
						latitudeDelta: 0.015,
						longitudeDelta: 0.015,
					},
					450,
				);
				clearFocusParams();
				return;
			}

			const mod = pendingFocusReaderRef.current();
			const hasUser =
				(focusUserId != null && focusUserId !== '') ||
				(mod?.userId != null && mod.userId !== '');
			const lat = focusLat ?? mod?.lat;
			const lng = focusLng ?? mod?.lng;
			const hasCoords =
				lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng);

			if (hasUser || hasCoords) {
				const userId =
					focusUserId != null && focusUserId !== '' ? focusUserId : mod?.userId;
				pendingFocusRef.current = {
					...(userId ? { userId } : {}),
					...(hasCoords ? { lat: lat as number, lng: lng as number } : {}),
					...(mod?.displayName != null ? { displayName: mod.displayName } : {}),
					...(mod?.avatarUrl !== undefined ? { avatarUrl: mod.avatarUrl } : {}),
					...(mod?.verification != null ? { verification: mod.verification } : {}),
					...(mod?.online != null ? { online: mod.online } : {}),
					...(mod?.lastSeenAt != null ? { lastSeenAt: mod.lastSeenAt } : {}),
				};
				// Allow re-apply on every View-on-map entry (new token or same peer).
				focusAppliedKeyRef.current = null;
			}

			// Defer one frame so MapView is attached after tab switch.
			const task = InteractionManager.runAfterInteractions(() => {
				tryApplyPendingFocus();
			});
			return () => task.cancel();
		}, [
			focusMyPin,
			myCoords,
			focusUserId,
			focusLat,
			focusLng,
			clearFocusParams,
			tryApplyPendingFocus,
		]),
	);

	useEffect(() => {
		tryApplyPendingFocus();
	}, [points, focusUserId, focusLat, focusLng, tryApplyPendingFocus]);

	useEffect(() => {
		if (!region) return;
		tryApplyPendingFocus();
	}, [region, tryApplyPendingFocus]);

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
					navigation.navigate('Chat', {
						conversationId: res.conversationId,
						otherUserName: '',
					});
				}
			} catch (e) {
				if (__DEV__) console.warn('wave failed', e);
				throw e;
			} finally {
				setWaving(null);
			}
		},
		[navigation],
	);

	const onSheetWave = useCallback(
		(toUserId: string) => {
			onWave(toUserId).catch((err: ApiError) => {
				appAlert(
					err.code === 'wave.cooldown' ? 'Already waved' : 'Could not send wave',
					err.message || 'Try again in a moment.',
				);
			});
		},
		[onWave],
	);

	const onSheetWavePress = (): void => {
		if (selected?.kind === 'user') onSheetWave(selected.id);
	};

	const onMapLongPress = useCallback(
		(e: LongPressEvent) => {
			if (selected) return;
			const { latitude, longitude } = e.nativeEvent.coordinate;
			track('map.longpress_create', { lat: latitude, lng: longitude });
			setCreateNearbyCoords({ lat: latitude, lng: longitude });
			setCreateNearbyOpen(true);
		},
		[selected],
	);

	const onCreateNearbySelect = useCallback(
		(action: CreateNearbyAction): void => {
			const location = createNearbyCoords;
			track('map.create_choice', { kind: action });
			const locParams = location ? { initialLocation: location } : {};
			switch (action) {
				case 'listing_sell':
					openRootScreen(navigation, 'ListingCreate', { mode: 'sell', ...locParams });
					break;
				case 'listing_buy':
					openRootScreen(navigation, 'ListingCreate', { mode: 'buy', ...locParams });
					break;
				case 'event':
					openRootScreen(navigation, 'EventCreate', locParams);
					break;
				case 'alert':
					openRootScreen(navigation, 'AlertComposer', locParams);
					break;
			}
		},
		[createNearbyCoords, navigation],
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
					showsUserLocation
					showsMyLocationButton={false}
					showsCompass={false}
					toolbarEnabled={false}
					onRegionChangeComplete={setRegion}
					onLongPress={onMapLongPress}
					initialRegion={{
						latitude: 43.21,
						longitude: 27.92,
						latitudeDelta: 0.05,
						longitudeDelta: 0.05,
					}}
				>
					<MapMarkers
						points={points}
						onClusterPress={onClusterPress}
						onEntityPress={onEntityPress}
					/>
				</MapView>
			</ErrorBoundary>

			{loading && (
				<View style={styles.loading} pointerEvents="none">
					<ActivityIndicator />
				</View>
			)}
			{!loading && !error && !sheetOpen && points.length === 0 && region != null ? (
				<View style={styles.emptyOverlay} pointerEvents="box-none">
					<EmptyState
						title="No one nearby yet"
						body="Pan the map or wait a moment — presence updates live. Share your pin so others can find you."
						actionLabel="Refresh area"
						onAction={refresh}
					/>
				</View>
			) : null}
			{error && (
				<View style={styles.errorBanner}>
					<Text style={styles.errorText}>{error}</Text>
					<TouchableOpacity onPress={refresh}>
						<Text style={styles.retry}>Retry</Text>
					</TouchableOpacity>
				</View>
			)}

			<MapChrome
				sheetOpen={sheetOpen}
				interactionUnread={interactionUnread}
				onPressInteractions={() => openRootScreen(navigation, 'Interactions')}
			/>

			{!sheetOpen && (
				<EventsRail location={region ? { lat: region.latitude, lng: region.longitude } : myCoords} />
			)}

			{!sheetOpen && <MapCoachMarks mapReady={region != null} />}

			<BottomSheetModal
				ref={entitySheetRef}
				snapPoints={entitySnapPoints}
				enablePanDownToClose
				enableDynamicSizing={false}
				backdropComponent={renderBackdrop}
				backgroundStyle={sheetChrome.background}
				handleIndicatorStyle={sheetChrome.handle}
				onDismiss={() => {
					presentedIdRef.current = null;
					setSelected(null);
				}}
			>
				<BottomSheetView style={sheetChrome.content}>
					{selected ? (
						<ErrorBoundary fallback={<Text style={styles.sheetError}>Could not load card</Text>}>
							<EntityBottomSheet
								point={selected}
								waving={selected.kind === 'user' && waving === selected.id}
								onClose={onCloseSheet}
								{...(selected.kind === 'user' && { onWave: onSheetWavePress })}
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
	const z = Math.log2(360 / Math.max(r.latitudeDelta, 0.0001));
	return Math.max(0, Math.min(22, Math.round(z)));
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	unavailable: {
		justifyContent: 'center',
		alignItems: 'center',
		backgroundColor: colors.bg,
		padding: 24,
	},
	unavailableTitle: { color: colors.danger, fontSize: 16, fontWeight: '700', marginBottom: 8 },
	unavailableBody: { color: colors.textMuted, fontSize: 13, textAlign: 'center', lineHeight: 20 },
	emptyOverlay: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: '38%',
		alignItems: 'center',
		paddingHorizontal: 24,
	},
	loading: {
		position: 'absolute',
		top: 120,
		alignSelf: 'center',
		padding: 8,
		borderRadius: 16,
		backgroundColor: 'rgba(0,0,0,0.5)',
	},
	errorBanner: {
		position: 'absolute',
		bottom: 32,
		left: 16,
		right: 16,
		padding: 12,
		borderRadius: 12,
		backgroundColor: colors.danger,
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'center',
	},
	errorText: { color: colors.textPrimary, flex: 1 },
	retry: { color: colors.textPrimary, fontWeight: '600' },
	sheetError: { color: colors.textMuted, padding: 16, textAlign: 'center' },
});
