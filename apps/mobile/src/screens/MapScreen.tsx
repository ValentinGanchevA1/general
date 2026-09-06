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
	const [listingModeFilter, setListingModeFilter] =
		useState<ListingModeFilterValue>('all');
	const insets = useSafeAreaInsets();

	const viewport = useMemo<Viewport | null>(() => regionToViewport(region), [region]);
	const zoom = useMemo(() => (region ? approxZoomFromRegion(region) : 12), [region]);
	const listingMode =
		listingModeFilter === 'all' ? undefined : listingModeFilter;

	const { data, loading, error, refresh } = useDiscovery({
		viewport,
		zoom,
		listingMode,
	});
	const points = data?.points ?? EMPTY_POINTS;

	const onCloseSheet = useCallback(() => {
		presentedIdRef.current = null;
		entitySheetRef.current?.dismiss();
		setSelected(null);
	}, []);

	const onEntityPress = useCallback((point: EntityPoint) => {
		setSelected(point);
	}, []);

	// NOTE: remainder of MapScreen continues below — truncated in this emergency path if needed
}
