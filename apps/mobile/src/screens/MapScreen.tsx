import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { DARK_MAP_STYLE, LIGHT_MAP_STYLE } from '@/components/map/mapStyle';
import {
	BottomSheetModal,
	BottomSheetView,
} from '@gorhom/bottom-sheet';
import { NearbyPeopleRail } from '@/components/map/NearbyPeopleRail';
import type {
	DiscoveryPoint,
	DiscoveryRankBy,
	EntityKind,
	EntityPoint,
	ClusterPoint,
	Viewport,
	CreateConversationRequest,
	CreateConversationResponse,
} from '@g88/shared';

import { useDiscovery } from '@/features/discovery/useDiscovery';
import { setPoints } from '@/features/discovery/discoverySlice';
import { useSocket } from '@/realtime/useSocket';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { useUserLocation } from '@/features/location/useUserLocation';
import { MapMarkers } from '@/components/map/MapMarkers';
import { prefetchAvatars } from '@/services/avatarCache';
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { EventsRail } from '@/features/events/EventsRail';
import {
	fetchNearbyStories,
	storyReceived,
} from '@/features/stories/storiesSlice';
import { useFocusEffect, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { postJson } from '@/api/client';
import { useAppTheme, type ThemeColors } from '@/theme';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { MapCoachMarks } from '@/components/map/MapCoachMarks';
import {
	MapFilterRow,
	DEFAULT_MAP_LAYERS,
	type ListingModeFilterValue,
} from '@/components/map/MapFilterRow';
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
import { useSheetChrome, useSheetBackdrop } from '@/components/sheets';
import {
	mapFilterRowTop,
	mapTrendingTop,
	type MapTopStackVisibility,
} from '@/components/map/mapChromeLayout';
import { useNudges } from '@/features/nudges/useNudges';
import { useChallenges } from '@/features/gamification/useChallenges';
import { usePinInteraction } from '@/features/map/usePinInteraction';
import {
	takePendingOpenCreateNearby,
	subscribePendingOpenCreateNearby,
} from '@/features/map/pendingCreateNearby';
import { PinInteractionHost } from '@/components/map/PinInteractionHost';
import {
	NEXA_ENTITY_SHEET_SNAP_POINTS,
	mapAnimationDuration,
	nexaEntitySelectionKey,
	regionForSelectedEntity,
} from '@/components/map/nexaMapSheetChoreography';
import { NexaMapSpatialStatus } from '@/components/map/NexaMapSpatialStatus';
import { resolveNexaMapSpatialState } from '@/components/map/nexaMapSpatialStates';
import { NEXA_MOTION_MS } from '@/motion/nexaMotion';
import { useNexaReducedMotion } from '@/motion/useNexaReducedMotion';

const EMPTY_POINTS: DiscoveryPoint[] = [];

export function MapScreen(): React.JSX.Element {
	const dispatch = useAppDispatch();
	const { colors, scheme } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const sheetChrome = useSheetChrome();
	const emailVerified = useAppSelector((s) => s.profile.profile?.badges?.email === true);
	const openToDating = useAppSelector((s) => s.profile.profile?.openToDating === true);
	const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
	const route = useRoute<RouteProp<TabParamList, 'Map'>>();
	const { coords: myCoords, requestPermission } = useUserLocation();
	const [region, setRegion] = useState<Region | null>(null);
	const [selected, setSelected] = useState<EntityPoint | null>(null);
	const [waveToast, setWaveToast] = useState<string | null>(null);
	const reduceMotion = useNexaReducedMotion();
	const mapRef = useRef<MapView>(null);
	const entitySheetRef = useRef<BottomSheetModal>(null);
	const presentedIdRef = useRef<string | null>(null);
	const selectedPointRef = useRef<EntityPoint | null>(null);
	const preSheetRegionRef = useRef<Region | null>(null);
	const entitySnapPoints = useMemo(() => [...NEXA_ENTITY_SHEET_SNAP_POINTS], []);
	const renderBackdrop = useSheetBackdrop(0.5);
	const { unreadCount: interactionUnread } = useReceivedInteractions();
	const [listingModeFilter, setListingModeFilter] = useState<ListingModeFilterValue>('all');
	const [layers, setLayers] = useState<EntityKind[]>(DEFAULT_MAP_LAYERS);
	const [friendsOnly, setFriendsOnly] = useState(false);
	const [datingOnly, setDatingOnly] = useState(false);
	const [rankBy, setRankBy] = useState<DiscoveryRankBy>('relevance');
	const [searchQuery, setSearchQuery] = useState('');
	const [trendingCollapsed, setTrendingCollapsed] = useState(true);
	const insets = useSafeAreaInsets();
	const viewerMode = datingOnly ? 'dating' : 'social';

	const pin = usePinInteraction({ viewerMode });
	const { openUserPin, dismiss: dismissPinPreview, openDetail: openPinDetail, openFull: openPinFull, backFromFull: backFromPinFull, isFull: pinIsFull, quickWave, quickLike, showPreview, previewProps, activePinId, pinLat, pinLng, seedDisplayName, sendWave: pinSendWave, sendLike: pinSendLike, sendPass: pinSendPass, sendMessage: pinSendMessage, pending: pinActionPending, likeSent: pinLikeSent, isMatch: pinIsMatch, conversationId: pinConversationId, datingConversationId: pinDatingConversationId } = pin;
	const suppressPinDismissRef = useRef(false);
	const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
	const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);
	const listingMode = listingModeFilter === 'all' ? undefined : listingModeFilter;
	const kinds = layers.length > 0 ? layers : DEFAULT_MAP_LAYERS;
	const peopleLayer = kinds.includes('user');
	const listingsLayer = kinds.includes('listing');
	const { data, loading, error, refresh: refreshDiscovery } = useDiscovery({ viewport, zoom, kinds, listingMode: peopleLayer && (friendsOnly || datingOnly) ? undefined : listingsLayer ? listingMode : undefined, friendsOnly: peopleLayer && friendsOnly, datingOnly: peopleLayer && datingOnly && !friendsOnly, rankBy });
	const points = data?.points ?? EMPTY_POINTS;
	const mapFocused = useIsFocused();
	const seenKeysRef = useRef<Set<string>>(new Set());
	const [seenReady, setSeenReady] = useState(false);
	const filteredPoints = useMemo(() => {
		const q = searchQuery.trim().toLowerCase();
		if (!q) return points;
		return points.filter((p) => p.kind === 'cluster' || (p.kind === 'user' ? p.meta.displayName.toLowerCase().includes(q) : p.meta.title.toLowerCase().includes(q)));
	}, [points, searchQuery]);
	const { createNearbyOpen, setCreateNearbyOpen, onMapLongPress, onCreateNearbySelect } = useCreateNearby(navigation, selected != null || showPreview);

	useMapFocus({ mapRef, myCoords, points: points.filter((p): p is EntityPoint => p.kind === 'user' || p.kind === 'event' || p.kind === 'listing'), region, setRegion, setSelected, setListingModeFilter, navigation, params: { focusMyPin: route.params?.focusMyPin === true, ...(route.params?.focusUserId != null ? { focusUserId: route.params.focusUserId } : {}), ...(route.params?.focusListingId != null ? { focusListingId: route.params.focusListingId } : {}), ...(route.params?.focusLat != null ? { focusLat: route.params.focusLat } : {}), ...(route.params?.focusLng != null ? { focusLng: route.params.focusLng } : {}) } });

	const onSheetDismiss = useCallback(() => { const restoreRegion = preSheetRegionRef.current; presentedIdRef.current = null; selectedPointRef.current = null; setSelected(null); if (suppressPinDismissRef.current) { suppressPinDismissRef.current = false; return; } preSheetRegionRef.current = null; if (restoreRegion != null) mapRef.current?.animateToRegion(restoreRegion, reduceMotion ? 0 : 220); dismissPinPreview(); }, [dismissPinPreview, reduceMotion]);
	const closeSheet = useCallback(() => entitySheetRef.current?.dismiss(), []);
	const presentEntitySheet = useCallback((point: EntityPoint) => { const id = `${point.kind}:${point.id}`; if (preSheetRegionRef.current == null && region != null) preSheetRegionRef.current = region; selectedPointRef.current = point; if (presentedIdRef.current !== id) presentedIdRef.current = null; setSelected(point); InteractionManager.runAfterInteractions(() => { try { entitySheetRef.current?.present(); presentedIdRef.current = id; } catch (e) { if (__DEV__) console.warn('entity sheet present failed', e); presentedIdRef.current = null; } }); }, [region]);
	const onSheetChange = useCallback((index: number) => { if (index < 0 || region == null) return; const point = selectedPointRef.current; if (point == null) return; mapRef.current?.animateToRegion(regionForSelectedEntity(region, point, index), mapAnimationDuration(index, reduceMotion)); }, [region, reduceMotion]);
	const onSheetOpenFull = useCallback((focus?: 'trust' | 'stats' | 'storyline' | 'photos' | 'bio' | 'mutual') => { if (activePinId == null) return; openPinFull(); suppressPinDismissRef.current = true; presentedIdRef.current = null; setSelected(null); entitySheetRef.current?.dismiss(); navigation.navigate('UserProfile', { userId: activePinId, ...(focus != null ? { focus } : {}) }); }, [activePinId, openPinFull, navigation]);

	useFocusEffect(useCallback(() => { if (!pinIsFull || activePinId == null) return; backFromPinFull(); const fromViewport = points.find((p): p is EntityPoint => p.kind === 'user' && p.id === activePinId); if (fromViewport) { presentEntitySheet(fromViewport); return; } presentEntitySheet({ kind: 'user', id: activePinId, lat: pinLat ?? region?.latitude ?? 0, lng: pinLng ?? region?.longitude ?? 0, meta: { displayName: seedDisplayName, avatarUrl: null, verification: 'none', online: false, lastSeenAt: null } }); }, [pinIsFull, activePinId, backFromPinFull, points, presentEntitySheet, pinLat, pinLng, seedDisplayName, region?.latitude, region?.longitude]));
	const onEntityPress = useCallback((point: EntityPoint) => { if (point.kind === 'user') { entitySheetRef.current?.dismiss(); setSelected(null); presentedIdRef.current = null; openUserPin(point); return; } dismissPinPreview(); presentEntitySheet(point); }, [openUserPin, dismissPinPreview, presentEntitySheet]);
	const onPreviewOpenDetail = useCallback(() => { openPinDetail(); if (activePinId == null) return; const fromViewport = points.find((p): p is EntityPoint => p.kind === 'user' && p.id === activePinId); if (fromViewport) presentEntitySheet(fromViewport); }, [openPinDetail, activePinId, points, presentEntitySheet]);
	const onClusterPress = useCallback((cluster: ClusterPoint) => { if (!region) return; mapRef.current?.animateToRegion({ latitude: cluster.lat, longitude: cluster.lng, latitudeDelta: Math.max(region.latitudeDelta / 2.2, 0.002), longitudeDelta: Math.max(region.longitudeDelta / 2.2, 0.002) }, reduceMotion ? 0 : NEXA_MOTION_MS.standard); }, [region, reduceMotion]);
	const myLat = myCoords?.lat ?? region?.latitude ?? null;
	const myLng = myCoords?.lng ?? region?.longitude ?? null;
	const openSheetMessage = useCallback(async () => { if (activePinId == null) return; const existing = pinConversationId ?? pinDatingConversationId; if (existing) { navigation.navigate('Chat', { conversationId: existing }); return; } const result = await pinSendMessage(); if (result.conversationId) navigation.navigate('Chat', { conversationId: result.conversationId }); }, [activePinId, pinConversationId, pinDatingConversationId, pinSendMessage, navigation]);
	const quickWaveUserIdRef = useRef<string | null>(null);
	useEffect(() => { if (!pinActionPending) quickWaveUserIdRef.current = null; }, [pinActionPending]);
	const socket = useSocket();
	useEffect(() => { if (!socket) return; const onStoryCreated = (payload: { story?: unknown }) => { if (!payload?.story || typeof payload.story !== 'object') return; dispatch(storyReceived(payload.story as never)); }; socket.on('story:created', onStoryCreated); return () => { socket.off('story:created', onStoryCreated); }; }, [socket, dispatch]);
	useEffect(() => { if (!viewport) return; dispatch(fetchNearbyStories({ viewport, limit: 50 })); }, [dispatch, viewport]);
	useEffect(() => { if (!points.length) return; prefetchAvatars(points.filter((p): p is EntityPoint => p.kind === 'user').map((p) => p.meta.avatarUrl).filter((u): u is string => typeof u === 'string' && u.length > 0)); }, [points]);
	useEffect(() => { let cancelled = false; void loadSeenKeys().then((keys) => { if (!cancelled) { seenKeysRef.current = keys; setSeenReady(true); } }); return () => { cancelled = true; }; }, []);
	useEffect(() => { if (!seenReady || !mapFocused) return; const newCount = countUnseen(points, seenKeysRef.current); dispatch(setMapNewCount(newCount)); const next = mergeSeen(seenKeysRef.current, points); seenKeysRef.current = next; void saveSeenKeys(next); return () => { dispatch(clearMapNewCount()); }; }, [points, seenReady, mapFocused, dispatch]);

	const sheetOpen = selected != null || showPreview;
	const selectedMarkerKey = useMemo(() => selected != null ? nexaEntitySelectionKey(selected) : showPreview && activePinId != null ? `user:${activePinId}` : null, [selected, showPreview, activePinId]);
	const isCityScale = region != null && region.latitudeDelta > 0 && region.latitudeDelta <= 0.25 && region.longitudeDelta > 0 && region.longitudeDelta <= 0.25;
	const spatialState = resolveNexaMapSpatialState({ hasRegion: region != null, loading, hasError: error != null, pointCount: points.length, viewportHash: data?.viewportHash ?? null, isCityScale });
	const isEmpty = spatialState === 'empty';
	const showNearbyPeopleRail = layers.includes('user') && isCityScale && !sheetOpen && !createNearbyOpen;
	const trendingItems = useMemo(() => buildTrending(points, myLat, myLng, 3), [points, myLat, myLng]);
	const trendingSummary = useMemo(() => { let people = 0; let events = 0; let listings = 0; for (const p of points) { if (p.kind === 'user') people += 1; else if (p.kind === 'event') events += 1; else if (p.kind === 'listing') listings += 1; } return { people, events, listings }; }, [points]);
	const onTrendingPress = useCallback((item: TrendingItem) => onEntityPress(item.point), [onEntityPress]);
	const { nudge } = useNudges();
	const { challenges } = useChallenges();
	const [challengeDismissed, setChallengeDismissed] = useState(false);
	const regionSettledOnceRef = useRef(false);
	const lastRegionRef = useRef<Region | null>(null);
	const onRegionChangeComplete = useCallback((next: Region) => { setRegion(next); if (!regionSettledOnceRef.current) { regionSettledOnceRef.current = true; lastRegionRef.current = next; return; } const prev = lastRegionRef.current; lastRegionRef.current = next; if (challengeDismissed || !prev) return; const moved = Math.abs(prev.latitude - next.latitude) > 0.0005 || Math.abs(prev.longitude - next.longitude) > 0.0005 || Math.abs(prev.latitudeDelta - next.latitudeDelta) > 0.01; if (moved) setChallengeDismissed(true); }, [challengeDismissed]);
	// One secondary prompt at a time: trust/verification/streak nudges outrank gamification.
	const topStack = useMemo<MapTopStackVisibility>(() => {
		const nudgeVisible = nudge != null;
		return {
			nudgeVisible,
			challengeVisible: !nudgeVisible && !challengeDismissed && challenges.some((challenge) => !challenge.completed),
		};
	}, [challengeDismissed, challenges, nudge]);
	const filterRowTop = mapFilterRowTop(insets.top, sheetOpen, topStack);
	const trendingTop = mapTrendingTop(insets.top, sheetOpen, topStack);
	const openCreateNearby = useCallback(() => setCreateNearbyOpen(true), [setCreateNearbyOpen]);
	useEffect(() => { const open = () => { if (takePendingOpenCreateNearby()) setCreateNearbyOpen(true); }; open(); return subscribePendingOpenCreateNearby(open); }, [setCreateNearbyOpen]);
	const { visible: createNudgeVisible, dismiss: dismissCreateNudge } = useMapCreateNudge({ mapReady: region != null, isEmpty, blocked: sheetOpen || createNearbyOpen });
	const onCreateNudgeCreate = useCallback(() => { dismissCreateNudge('create'); openCreateNearby(); }, [dismissCreateNudge, openCreateNearby]);
	const emptyCopy = mapEmptyCopy({ friendsOnly, datingOnly, openToDating, listingMode: listingModeFilter, emailVerified });
	const onSpatialEmptyAction = useCallback(() => { switch (emptyCopy.actionKind) { case 'show_everyone': setFriendsOnly(false); return; case 'clear_dating': setDatingOnly(false); return; case 'dating_prefs': openRootScreen(navigation, 'ProfileEdit', { focus: 'dating' }); return; case 'verify_email': openRootScreen(navigation, 'TrustCenter', { focusStep: 'email' }); return; case 'create': openCreateNearby(); } }, [emptyCopy.actionKind, navigation, openCreateNearby]);
	const zoomInForDiscovery = useCallback(() => { if (!region) return; mapRef.current?.animateToRegion({ ...region, latitudeDelta: Math.max(region.latitudeDelta / 2.2, 0.01), longitudeDelta: Math.max(region.longitudeDelta / 2.2, 0.01) }, reduceMotion ? 0 : NEXA_MOTION_MS.standard); }, [region, reduceMotion]);
	const recenter = useCallback(() => { if (!myCoords) { void requestPermission(); return; } mapRef.current?.animateToRegion({ latitude: myCoords.lat, longitude: myCoords.lng, latitudeDelta: 0.04, longitudeDelta: 0.04 }, reduceMotion ? 0 : NEXA_MOTION_MS.standard); }, [myCoords, requestPermission, reduceMotion]);
	useEffect(() => { if (mapFocused || region == null) return; const t = setInterval(refreshDiscovery, 60_000); return () => clearInterval(t); }, [mapFocused, region, refreshDiscovery]);

	return (
		<View style={styles.root}>
			<ErrorBoundary fallback={<MapUnavailableFallback />}><MapView ref={mapRef} provider={PROVIDER_GOOGLE} customMapStyle={scheme === 'dark' ? DARK_MAP_STYLE : LIGHT_MAP_STYLE} style={StyleSheet.absoluteFill} showsUserLocation showsMyLocationButton={false} showsCompass={false} toolbarEnabled={false} onRegionChangeComplete={onRegionChangeComplete} onLongPress={onMapLongPress}><MapMarkers points={filteredPoints} selectedEntityKey={selectedMarkerKey} dimUnselected={selected != null} onEntityPress={onEntityPress} onClusterPress={onClusterPress} /></MapView></ErrorBoundary>
			<MapChrome sheetOpen={sheetOpen} interactionUnread={interactionUnread} onPressInteractions={() => openRootScreen(navigation, 'Interactions')} topStack={topStack} onDismissChallenge={() => setChallengeDismissed(true)} />
			<MapFilterRow value={searchQuery} onChangeText={setSearchQuery} layers={layers} onLayersChange={setLayers} listingMode={listingModeFilter} onListingModeChange={setListingModeFilter} friendsOnly={friendsOnly} onFriendsOnlyChange={setFriendsOnly} datingOnly={datingOnly} onDatingOnlyChange={setDatingOnly} rankBy={rankBy} onRankByChange={setRankBy} top={filterRowTop} onPressCreate={openCreateNearby} onPressRecenter={recenter} />
			<TrendingCard items={trendingItems} onPressItem={onTrendingPress} top={trendingTop} visible={isCityScale && !sheetOpen && points.length > 0 && searchQuery.trim() === ''} collapsed={trendingCollapsed} onToggleCollapse={() => setTrendingCollapsed((v) => !v)} summary={trendingSummary} />
			{createNudgeVisible ? <MapCreateNudgeBanner onCreate={onCreateNudgeCreate} onDismiss={() => dismissCreateNudge('dismiss')} /> : null}
			<NexaMapSpatialStatus state={spatialState} emptyCopy={emptyCopy} hidden={sheetOpen || createNearbyOpen || (spatialState === 'empty' && (createNudgeVisible || nudge != null))} onEmptyAction={onSpatialEmptyAction} onRetry={refreshDiscovery} onZoomIn={zoomInForDiscovery} />
			<MapCoachMarks mapReady={region != null} />
			<BottomSheetModal ref={entitySheetRef} index={0} snapPoints={entitySnapPoints} enableDynamicSizing={false} enablePanDownToClose animateOnMount={!reduceMotion} onChange={onSheetChange} onDismiss={onSheetDismiss} backdropComponent={renderBackdrop} backgroundStyle={sheetChrome.background} handleIndicatorStyle={sheetChrome.handle}><BottomSheetView style={sheetChrome.content}>{selected ? <EntityBottomSheet point={selected} waving={pinActionPending && activePinId === selected.id} onClose={closeSheet} viewerMode={viewerMode} {...(selected.kind === 'user' ? { onOpenFull: onSheetOpenFull, onMessage: () => { void openSheetMessage(); } } : {})} {...(selected.kind === 'user' && viewerMode === 'social' ? { onWave: pinSendWave } : {})} {...(selected.kind === 'user' && viewerMode === 'dating' ? { onLike: pinSendLike, onPass: () => { pinSendPass(); closeSheet(); }, likeSent: pinLikeSent, isMatch: pinIsMatch, actionPending: pinActionPending } : {})} /></BottomSheetView></BottomSheetModal>
			{waveToast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{waveToast}</Text></View> : null}
			{showPreview && previewProps ? <PinInteractionHost visible previewProps={previewProps} onDismiss={dismissPinPreview} onOpenDetail={onPreviewOpenDetail} onQuickWave={quickWave} onQuickLike={quickLike} /> : null}
			<CreateNearbySheet visible={createNearbyOpen} onClose={() => setCreateNearbyOpen(false)} onSelect={onCreateNearbySelect} />
			<NearbyPeopleRail points={filteredPoints} visible={showNearbyPeopleRail} onPressUser={onEntityPress} />
			{myCoords ? <EventsRail location={myCoords} /> : null}
		</View>
	);
}

function MapUnavailableFallback(): React.JSX.Element {
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	return <View style={styles.fallback}><Text style={styles.fallbackTitle}>Map unavailable</Text><Text style={styles.fallbackBody}>We couldn't load the map. You can still use the rest of NEXA.</Text></View>;
}

function regionToViewport(region: Region | null): Viewport | null {
	if (!region) return null;
	return { north: region.latitude + region.latitudeDelta / 2, south: region.latitude - region.latitudeDelta / 2, east: region.longitude + region.longitudeDelta / 2, west: region.longitude - region.longitudeDelta / 2 };
}

function approxZoomFromRegion(region: Region): number {
	return Math.max(1, Math.min(20, Math.log2(360 / Math.max(region.longitudeDelta, 0.0001))));
}

function createStyles(colors: ThemeColors) {
	return StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.background },
		fallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background },
		fallbackTitle: { color: colors.textPrimary, fontSize: 20, fontWeight: '800' },
		fallbackBody: { color: colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
		toast: { position: 'absolute', left: 24, right: 24, bottom: 120, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSubtle },
		toastText: { color: colors.textPrimary, textAlign: 'center', fontWeight: '700' },
	});
}
