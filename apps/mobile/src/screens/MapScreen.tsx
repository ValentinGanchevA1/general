import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	StyleSheet,
	Text,
	View,
} from 'react-native';

import { appAlert } from '@/ui/appAlert';
import type { Region } from 'react-native-maps';
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
import type { NexaMapController } from '@/features/map/contracts/mapRenderer';
import { NexaMapScreenSurface } from '@/features/map/renderers/NexaMapScreenSurface';
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
import { useNexaMapSurfaceReady } from '@/components/Brand/NexaLaunchSurfaceContext';

const EMPTY_POINTS: DiscoveryPoint[] = [];

export function MapScreen(): React.JSX.Element {
	const dispatch = useAppDispatch();
	const { colors, scheme, mode } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const sheetChrome = useSheetChrome();
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
	const reduceMotion = useNexaReducedMotion();
	const markMapSurfaceReady = useNexaMapSurfaceReady();
	const mapRef = useRef<NexaMapController | null>(null);
	const entitySheetRef = useRef<BottomSheetModal>(null);
	const presentedIdRef = useRef<string | null>(null);
	const selectedPointRef = useRef<EntityPoint | null>(null);
	const preSheetRegionRef = useRef<Region | null>(null);
	const entitySnapPoints = useMemo(() => [...NEXA_ENTITY_SHEET_SNAP_POINTS], []);
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

	const viewerMode = datingOnly ? 'dating' : 'social';
	const {
		openUserPin,
		dismiss: dismissPinPreview,
		openDetail: openPinDetail,
		openFull: openPinFull,
		backFromFull: backFromPinFull,
		isFull: pinIsFull,
		quickWave,
		quickLike,
		showPreview,
		previewProps,
		activePinId,
		pinLat,
		pinLng,
		seedDisplayName,
		send: pinSend,
		sendWave: pinSendWave,
		sendLike: pinSendLike,
		sendPass: pinSendPass,
		sendMessage: pinSendMessage,
		pending: pinActionPending,
		likeSent: pinLikeSent,
		isMatch: pinIsMatch,
		hasMutualWave: pinHasMutualWave,
		conversationId: pinConversationId,
		datingConversationId: pinDatingConversationId,
		lastResult: pinLastResult,
		machineError: pinMachineError,
	} = usePinInteraction({ viewerMode });
	const suppressPinDismissRef = useRef(false);

	const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
	const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);
	const listingMode =
		listingModeFilter === 'all' ? undefined : listingModeFilter;

	const kinds = layers.length > 0 ? layers : DEFAULT_MAP_LAYERS;
	const peopleLayer = kinds.includes('user');
	const listingsLayer = kinds.includes('listing');

	const {
		data,
		loading,
		error,
		refresh: refreshDiscovery,
	} = useDiscovery({
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
	} = useCreateNearby(navigation, selected != null || showPreview);

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
				? { focusListingId: route.params.focusListingId } : {}),
			...(route.params?.focusLat != null ? { focusLat: route.params.focusLat } : {}),
			...(route.params?.focusLng != null ? { focusLng: route.params.focusLng } : {}),
		},
	});

	const onSheetDismiss = useCallback(() => {
		const restoreRegion = preSheetRegionRef.current;
		presentedIdRef.current = null;
		selectedPointRef.current = null;
		setSelected(null);
		if (suppressPinDismissRef.current) {
			suppressPinDismissRef.current = false;
			return;
		}
		preSheetRegionRef.current = null;
		if (restoreRegion != null) {
			mapRef.current?.fitViewport(regionToViewport(restoreRegion), {
				durationMs: reduceMotion ? 0 : 220,
			});
		}
		dismissPinPreview();
	}, [dismissPinPreview, reduceMotion]);

	const closeSheet = useCallback(() => {
		entitySheetRef.current?.dismiss();
	}, []);

	const presentEntitySheet = useCallback((point: EntityPoint) => {
		if (preSheetRegionRef.current == null && region != null) {
			preSheetRegionRef.current = region;
		}
		selectedPointRef.current = point;
		presentedIdRef.current = null;
		setSelected(point);
	}, [region]);

	const onSheetChange = useCallback(
		(index: number) => {
			if (index < 0 || region == null) return;
			const point = selectedPointRef.current;
			if (point == null) return;
			const target = regionForSelectedEntity(region, point, index);
			mapRef.current?.fitViewport(regionToViewport(target), {
				durationMs: mapAnimationDuration(index, reduceMotion),
			});
		},
		[region, reduceMotion],
	);

	const onSheetOpenFull = useCallback(
		(focus?: 'trust' | 'stats' | 'storyline' | 'photos' | 'bio' | 'mutual') => {
			if (activePinId == null) return;
			openPinFull();
			suppressPinDismissRef.current = true;
			presentedIdRef.current = null;
			setSelected(null);
			entitySheetRef.current?.dismiss();
			navigation.navigate('UserProfile', {
				userId: activePinId,
				...(focus != null ? { focus } : {}),
			});
		},
		[activePinId, openPinFull, navigation],
	);

	useFocusEffect(
		useCallback(() => {
			if (!pinIsFull || activePinId == null) return;
			backFromPinFull();
			const fromViewport = points.find(
				(p): p is EntityPoint => p.kind === 'user' && p.id === activePinId,
			);
			if (fromViewport) {
				presentEntitySheet(fromViewport);
				return;
			}
			const lat = pinLat ?? region?.latitude ?? 0;
			const lng = pinLng ?? region?.longitude ?? 0;
			presentEntitySheet({
				kind: 'user',
				id: activePinId,
				lat,
				lng,
				meta: {
					displayName: seedDisplayName,
					avatarUrl: null,
					verification: 'none',
					online: false,
					lastSeenAt: null,
				},
			});
		}, [
			pinIsFull,
			activePinId,
			backFromPinFull,
			points,
			presentEntitySheet,
			pinLat,
			pinLng,
			seedDisplayName,
			region?.latitude,
			region?.longitude,
		]),
	);

	const onEntityPress = useCallback(
		(point: EntityPoint) => {
			if (point.kind === 'user') {
				entitySheetRef.current?.dismiss();
				setSelected(null);
				presentedIdRef.current = null;
				openUserPin(point);
				return;
			}
			dismissPinPreview();
			presentEntitySheet(point);
		},
		[openUserPin, dismissPinPreview, presentEntitySheet],
	);

	const onPreviewOpenDetail = useCallback(() => {
		openPinDetail();
		if (activePinId == null) return;
		const fromViewport = points.find(
			(p): p is EntityPoint => p.kind === 'user' && p.id === activePinId,
		);
		if (fromViewport) {
			presentEntitySheet(fromViewport);
			return;
		}
		const lat = pinLat ?? region?.latitude ?? 0;
		const lng = pinLng ?? region?.longitude ?? 0;
		presentEntitySheet({
			kind: 'user',
			id: activePinId,
			lat,
			lng,
			meta: {
				displayName: seedDisplayName,
				avatarUrl: null,
				verification: 'none',
				online: false,
				lastSeenAt: null,
			},
		});
	}, [
		openPinDetail,
		activePinId,
		points,
		presentEntitySheet,
		pinLat,
		pinLng,
		seedDisplayName,
		region?.latitude,
		region?.longitude,
	]);

	useEffect(() => {
		selectedPointRef.current = selected;
		if (!selected) {
			presentedIdRef.current = null;
			return;
		}
		const id = `${selected.kind}:${selected.id}`;
		if (presentedIdRef.current === id) return;

		const frame = requestAnimationFrame(() => {
			const sheet = entitySheetRef.current;
			if (sheet == null) {
				if (__DEV__) console.warn('entity sheet ref unavailable', id);
				presentedIdRef.current = null;
				return;
			}
			try {
				sheet.present();
				presentedIdRef.current = id;
			} catch (e) {
				if (__DEV__) console.warn('entity sheet present failed', e);
				presentedIdRef.current = null;
			}
		});
		return () => cancelAnimationFrame(frame);
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

	useEffect(() => {
		const unsubMutual = on('wave:mutual', (e) => {
			if (activePinId != null && e.peerUserId === activePinId) {
				pinSend({ type: 'WAVE_MUTUAL' });
			}
		});
		const unsubMatch = on('dating:match_created', (e) => {
			if (activePinId != null && e.peerUserId === activePinId) {
				pinSend({
					type: 'MATCH_CREATED',
					datingConversationId: e.datingConversationId,
				});
			}
		});
		return () => {
			unsubMutual();
			unsubMatch();
		};
	}, [on, activePinId, pinSend]);

	useEffect(() => {
		if (pinMachineError == null || pinMachineError === '') return;
		appAlert('Action failed', pinMachineError);
	}, [pinMachineError]);

	useEffect(() => {
		if (pinLastResult === 'matched' && pinDatingConversationId) {
			const name = seedDisplayName;
			const conversationId = pinDatingConversationId;
			const peerId = activePinId;
			appAlert("It's a match!", 'Say hi in chat.', [
				{ text: 'Later', style: 'cancel' },
				{
					text: 'Message',
					onPress: () => {
						if (peerId == null) return;
						openRootScreen(navigation, 'Chat', {
							conversationId,
							otherUserName: name,
							otherUserId: peerId,
						});
					},
				},
			]);
			return;
		}
		if (pinLastResult === 'wave_sent' && pinHasMutualWave && pinConversationId) {
			const name = seedDisplayName;
			const conversationId = pinConversationId;
			const peerId = activePinId;
			appAlert('Match!', 'You both waved — say hi.', [
				{ text: 'Later', style: 'cancel' },
				{
					text: 'Message',
					onPress: () => {
						if (peerId == null) return;
						openRootScreen(navigation, 'Chat', {
							conversationId,
							otherUserName: name,
							otherUserId: peerId,
						});
					},
				},
			]);
		}
	}, [
		pinLastResult,
		pinDatingConversationId,
		pinConversationId,
		pinHasMutualWave,
		seedDisplayName,
		activePinId,
		navigation,
	]);

	const openSheetMessage = useCallback(async (): Promise<void> => {
		if (selected == null || selected.kind !== 'user') return;
		const peerId = selected.id;
		const name =
			selected.meta && 'displayName' in selected.meta && typeof selected.meta.displayName === 'string'
				? selected.meta.displayName
				: seedDisplayName;
		const existing =
			viewerMode === 'dating'
				? pinDatingConversationId
				: pinConversationId ?? pinDatingConversationId;
		if (existing != null && existing !== '') {
			pinSendMessage();
			closeSheet();
			openRootScreen(navigation, 'Chat', {
				conversationId: existing,
				otherUserName: name,
				otherUserId: peerId,
			});
			return;
		}
		try {
			const res = await postJson<CreateConversationRequest, CreateConversationResponse>(
				'/conversations',
				{ targetUserId: peerId },
			);
			pinSendMessage();
			closeSheet();
			openRootScreen(navigation, 'Chat', {
				conversationId: res.conversationId,
				otherUserName: name,
				otherUserId: peerId,
				requestPending: res.status === 'pending' && res.permission === 'request',
			});
		} catch (e) {
			const msg =
				e && typeof e === 'object' && 'message' in e
					? String((e as { message: unknown }).message)
					: 'Try again in a moment.';
			appAlert('Could not open chat', msg);
		}
	}, [
		selected,
		seedDisplayName,
		viewerMode,
		pinConversationId,
		pinDatingConversationId,
		pinSendMessage,
		closeSheet,
		navigation,
	]);

	const onClusterPress = useCallback(
		(c: ClusterPoint) => {
			const target: Region = {
				latitude: c.lat,
				longitude: c.lng,
				latitudeDelta: Math.max(0.005, (region?.latitudeDelta ?? 0.05) / 2.5),
				longitudeDelta: Math.max(0.005, (region?.longitudeDelta ?? 0.05) / 2.5),
			};
			mapRef.current?.fitViewport(regionToViewport(target), {
				durationMs: reduceMotion ? 0 : NEXA_MOTION_MS.map,
			});
		},
		[reduceMotion, region?.latitudeDelta, region?.longitudeDelta],
	);

	const zoomInForDiscovery = useCallback(() => {
		if (region == null) return;
		const target: Region = {
			...region,
			latitudeDelta: Math.max(0.005, region.latitudeDelta / 2.5),
			longitudeDelta: Math.max(0.005, region.longitudeDelta / 2.5),
		};
		mapRef.current?.fitViewport(regionToViewport(target), {
			durationMs: reduceMotion ? 0 : NEXA_MOTION_MS.map,
		});
	}, [reduceMotion, region]);

	useEffect(() => {
		let msg: string | null = null;
		if (pinLastResult === 'wave_sent' && !pinHasMutualWave) {
			msg = 'Wave sent';
		} else if (pinLastResult === 'like_sent' && !pinIsMatch) {
			msg = 'Like sent';
		}
		if (msg == null) return;
		const t = setTimeout(() => setWaveToast(msg), 0);
		return () => clearTimeout(t);
	}, [pinLastResult, pinHasMutualWave, pinIsMatch]);

	useEffect(() => {
		if (!waveToast) return;
		const t = setTimeout(() => setWaveToast(null), 2200);
		return () => clearTimeout(t);
	}, [waveToast]);

	const sheetOpen = selected != null || showPreview;
	const selectedMarkerKey = useMemo(() => {
		if (selected != null) return nexaEntitySelectionKey(selected);
		if (showPreview && activePinId != null) return `user:${activePinId}`;
		return null;
	}, [selected, showPreview, activePinId]);
	const isCityScale =
		region != null &&
		region.latitudeDelta > 0 &&
		region.latitudeDelta <= 0.25 &&
		region.longitudeDelta > 0 &&
		region.longitudeDelta <= 0.25;
	const spatialState = resolveNexaMapSpatialState({
		hasRegion: region != null,
		loading,
		hasError: error != null,
		pointCount: points.length,
		viewportHash: data?.viewportHash ?? null,
		isCityScale,
	});
	const isEmpty = spatialState === 'empty';

	const peopleLayerOn = layers.includes('user');
	const showNearbyPeopleRail =
		peopleLayerOn &&
		isCityScale &&
		!sheetOpen &&
		!createNearbyOpen;

	const trendingItems = useMemo(
		() => buildTrending(points, myLat, myLng, 3),
		[points, myLat, myLng],
	);

	const trendingSummary = useMemo(() => {
		let people = 0;
		let events = 0;
		let listings = 0;
		for (const p of points) {
			if (p.kind === 'user') people += 1;
			else if (p.kind === 'event') events += 1;
			else if (p.kind === 'listing') listings += 1;
		}
		return { people, events, listings };
	}, [points]);

	const onTrendingPress = useCallback(
		(item: TrendingItem) => {
			onEntityPress(item.point);
		},
		[onEntityPress],
	);

	const { nudge } = useNudges();
	const { challenges } = useChallenges();
	const [challengeDismissed, setChallengeDismissed] = useState(false);
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

	const topStack = useMemo<MapTopStackVisibility>(() => {
		const nudgeVisible = nudge != null;
		return {
			nudgeVisible,
			challengeVisible:
				!nudgeVisible &&
				!challengeDismissed &&
				challenges.some((challenge) => !challenge.completed),
		};
	}, [challengeDismissed, challenges, nudge]);
	const filterRowTop = mapFilterRowTop(insets.top, sheetOpen, topStack);
	const trendingTop = mapTrendingTop(insets.top, sheetOpen, topStack);

	const openCreateNearby = useCallback(() => {
		setCreateNearbyOpen(true);
	}, [setCreateNearbyOpen]);

	useEffect(() => {
		const open = () => {
			if (takePendingOpenCreateNearby()) {
				setCreateNearbyOpen(true);
			}
		};
		open();
		return subscribePendingOpenCreateNearby(open);
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

	const onSpatialEmptyAction = useCallback(() => {
		switch (emptyCopy.actionKind) {
			case 'show_everyone':
				setFriendsOnly(false);
				return;
			case 'clear_dating':
				setDatingOnly(false);
				return;
			case 'dating_prefs':
				openRootScreen(navigation, 'ProfileEdit', { focus: 'dating' });
				return;
			case 'verify_email':
				openRootScreen(navigation, 'TrustCenter', { focusStep: 'email' });
				return;
			case 'create':
				openCreateNearby();
		}
	}, [emptyCopy.actionKind, navigation, openCreateNearby]);

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
				<NexaMapScreenSurface
					ref={mapRef}
					points={filteredPoints}
					selectedEntityKey={selectedMarkerKey}
					dimUnselected={selected != null}
					mode={mode}
					scheme={scheme}
					onReady={markMapSurfaceReady}
					onRegionChangeComplete={onRegionChangeComplete}
					onLongPress={onMapLongPress}
					onEntityPress={onEntityPress}
					onClusterPress={onClusterPress}
				/>
			</ErrorBoundary>

			<MapChrome
				sheetOpen={sheetOpen}
				interactionUnread={interactionUnread}
				onPressInteractions={() => openRootScreen(navigation, 'Interactions')}
				topStack={topStack}
				onDismissChallenge={() => setChallengeDismissed(true)}
			/>

			<MapFilterRow
				value={searchQuery}
				onChangeText={setSearchQuery}
				layers={layers}
				onLayersChange={setLayers}
				listingMode={listingModeFilter}
				onListingModeChange={setListingModeFilter}
				friendsOnly={friendsOnly}
				onFriendsOnlyChange={setFriendsOnly}
				datingOnly={datingOnly}
				onDatingOnlyChange={setDatingOnly}
				rankBy={rankBy}
				onRankByChange={setRankBy}
				top={filterRowTop}
				onPressCreate={openCreateNearby}
			/>

			<TrendingCard
				items={trendingItems}
				onPressItem={onTrendingPress}
				top={trendingTop}
				visible={
					isCityScale &&
					!sheetOpen &&
					points.length > 0 &&
					searchQuery.trim() === ''
				}
				collapsed={trendingCollapsed}
				onToggleCollapse={() => setTrendingCollapsed((v) => !v)}
				summary={trendingSummary}
			/>

			{createNudgeVisible ? (
				<MapCreateNudgeBanner
					onCreate={onCreateNudgeCreate}
					onDismiss={() => dismissCreateNudge('dismiss')}
				/>
			) : null}

			<NexaMapSpatialStatus
				state={spatialState}
				emptyCopy={emptyCopy}
				hidden={
					sheetOpen ||
					createNearbyOpen ||
					(spatialState === 'empty' && (createNudgeVisible || nudge != null))
				}
				onEmptyAction={onSpatialEmptyAction}
				onRetry={refreshDiscovery}
				onZoomIn={zoomInForDiscovery}
			/>

			<MapCoachMarks mapReady={region != null} />

			<BottomSheetModal
				ref={entitySheetRef}
				index={0}
				snapPoints={entitySnapPoints}
				enableDynamicSizing={false}
				enablePanDownToClose
				animateOnMount={!reduceMotion}
				onChange={onSheetChange}
				onDismiss={onSheetDismiss}
				backdropComponent={renderBackdrop}
				backgroundStyle={sheetChrome.background}
				handleIndicatorStyle={sheetChrome.handle}
			>
				<BottomSheetView style={sheetChrome.content}>
					{selected ? (
						<EntityBottomSheet
							point={selected}
							waving={pinActionPending && activePinId === selected.id}
							onClose={closeSheet}
							viewerMode={viewerMode}
							{...(selected.kind === 'user'
								? { onOpenFull: onSheetOpenFull }
								: {})}
							{...(selected.kind === 'user'
								? {
									onMessage: () => {
										void openSheetMessage();
									},
								}
								: {})}
							{...(selected.kind === 'user' && viewerMode === 'social'
								? {
									onWave: () => {
										pinSendWave();
									},
								}
								: {})}
							{...(selected.kind === 'user' && viewerMode === 'dating'
								? {
									onLike: () => {
										pinSendLike();
									},
									onPass: () => {
										pinSendPass();
										closeSheet();
									},
									likeSent: pinLikeSent,
									isMatch: pinIsMatch,
									actionPending: pinActionPending,
								}
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

			{showPreview && previewProps ? (
				<PinInteractionHost
					visible
					previewProps={previewProps}
					onDismiss={dismissPinPreview}
					onOpenDetail={onPreviewOpenDetail}
					onQuickWave={quickWave}
					onQuickLike={quickLike}
				/>
			) : null}

			<CreateNearbySheet
				visible={createNearbyOpen}
				onClose={() => setCreateNearbyOpen(false)}
				onSelect={onCreateNearbySelect}
			/>

			<NearbyPeopleRail
				points={filteredPoints}
				visible={showNearbyPeopleRail}
				onPressUser={(p) => onEntityPress(p)}
			/>

			{myCoords ? <EventsRail location={myCoords} /> : null}
		</View>
	);
}

function MapUnavailableFallback(): React.JSX.Element {
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	return (
		<View style={styles.unavailable}>
			<Text style={styles.unavailableEyebrow}>NEXA MAP</Text>
			<Text style={styles.unavailableTitle}>Map view interrupted</Text>
			<Text style={styles.unavailableBody}>
				NEXA could not render the map surface. Reopen this screen or restart the app.
			</Text>
		</View>
	);
}

function regionToViewport(region: Region): Viewport;
function regionToViewport(region: null): null;
function regionToViewport(region: Region | null): Viewport | null {
	if (!region) return null;
	const ne = {
		lat: region.latitude + region.latitudeDelta / 2,
		lng: region.longitude + region.longitudeDelta / 2,
	};
	const sw = {
		lat: region.latitude - region.latitudeDelta / 2,
		lng: region.longitude - region.longitudeDelta / 2,
	};
	return { ne, sw };
}

function approxZoomFromRegion(region: Region): number {
	const latDelta = Math.max(region.latitudeDelta, 0.0001);
	return Math.round(Math.log2(360 / latDelta));
}

function createStyles(colors: ThemeColors) {
	return StyleSheet.create({
		root: { flex: 1, backgroundColor: colors.bg },
		filterRow: { position: 'absolute', left: 0, right: 0, zIndex: 20 },
		trendingWrap: { position: 'absolute', left: 0, right: 0, zIndex: 19 },
		toast: {
			position: 'absolute',
			alignSelf: 'center',
			top: '42%',
			backgroundColor: colors.surface,
			paddingHorizontal: 16,
			paddingVertical: 10,
			borderRadius: 20,
			zIndex: 50,
		},
		toastText: { color: colors.textPrimary, fontWeight: '600' },
		unavailable: {
			flex: 1,
			alignItems: 'center',
			justifyContent: 'center',
			padding: 24,
			backgroundColor: colors.canvas,
		},
		unavailableEyebrow: {
			color: colors.discovery,
			fontSize: 11,
			fontWeight: '800',
			letterSpacing: 1.2,
		},
		unavailableTitle: {
			color: colors.textPrimary,
			fontSize: 19,
			fontWeight: '800',
			marginTop: 8,
		},
		unavailableBody: {
			color: colors.textSecondary,
			marginTop: 8,
			lineHeight: 20,
			textAlign: 'center',
			maxWidth: 320,
		},
	});
}
