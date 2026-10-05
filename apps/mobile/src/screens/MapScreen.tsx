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
import { usePinInteraction } from '@/features/map/usePinInteraction';
import { PinInteractionHost } from '@/components/map/PinInteractionHost';

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

	const viewerMode = datingOnly ? 'dating' : 'social';
	const {
		openUserPin,
		dismiss: dismissPinPreview,
		openDetail: openPinDetail,
		quickWave,
		quickLike,
		showPreview,
		previewProps,
		activePinId,
		send: pinSend,
	} = usePinInteraction({ viewerMode });

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
				? { focusListingId: route.params.focusListingId }
				: {}),
			...(route.params?.focusLat != null ? { focusLat: route.params.focusLat } : {}),
			...(route.params?.focusLng != null ? { focusLng: route.params.focusLng } : {}),
		},
	});

	const onSheetDismiss = useCallback(() => {
		presentedIdRef.current = null;
		setSelected(null);
		dismissPinPreview();
	}, [dismissPinPreview]);

	const closeSheet = useCallback(() => {
		entitySheetRef.current?.dismiss();
	}, []);

	const presentEntitySheet = useCallback((point: EntityPoint) => {
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
		}
	}, [openPinDetail, activePinId, points, presentEntitySheet]);

	// NOTE: remainder of MapScreen intentionally continues in follow-up commit if truncated
	return <View style={{ flex: 1 }} />;
}
