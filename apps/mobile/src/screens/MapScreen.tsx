import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	InteractionManager,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import MapView, {
	type LongPressEvent,
	PROVIDER_GOOGLE,
	type Region,
} from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
	BottomSheetModal,
	BottomSheetView,
} from '@gorhom/bottom-sheet';
import { useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type {
	DiscoveryPoint,
	DiscoveryRankBy,
	EntityKind,
	EntityPoint,
	Viewport,
} from '@g88/shared';
import type { ApiError } from '@g88/shared';

import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { useDiscovery } from '@/features/discovery/useDiscovery';
import { useUserLocation } from '@/hooks/useUserLocation';
import { MapMarkers } from '@/components/map/MapMarkers';
import { EntityBottomSheet } from '@/components/map/EntityBottomSheet';
import { MapFilterRow, DEFAULT_MAP_LAYERS, type ListingModeFilterValue } from '@/components/map/MapFilterRow';
import { MapChrome } from '@/components/map/MapChrome';
import { TrendingCard, buildTrending, type TrendingItem } from '@/components/map/TrendingCard';
import { EmptyState } from '@/components/EmptyState';
import { EventsRail } from '@/components/map/EventsRail';
import { MapCoachMarks } from '@/components/map/MapCoachMarks';
import { CreateNearbySheet } from '@/components/map/CreateNearbySheet';
import { colors } from '@/theme';
import { MAP_STYLE } from '@/components/map/mapStyle';
import { postJson } from '@/api/client';
import { appAlert } from '@/ui/appAlert';
import { openRootScreen } from '@/navigation/openRootScreen';
import type { RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { useReceivedInteractions } from '@/features/interactions/useReceivedInteractions';
import { mapEmptyCopy } from '@/components/map/mapEmptyCopy';
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

	// NOTE: remainder of MapScreen is truncated in this push helper — DO NOT USE
}
