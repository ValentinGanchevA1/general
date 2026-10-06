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
	DiscoveryPoint,
	DiscoveryRankBy,
	EntityKind,
	EntityPoint,
	ClusterPoint,
	Viewport,
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
	const mapRef = useRef<MapView>(null);
	const entitySheetRef = useRef<BottomSheetModal>(null);
	const presentedIdRef = useRef<string | null>(null);
	const entitySnapPoints = useMemo(() => ['36%', '62%'], []);
	const renderBackdrop = useSheetBackdrop(0.5);
	const { unreadCount: interactionUnread } = useReceivedInteractions();

	// RESTORE_INCOMPLETE - see artifacts/MapScreen.FULL.tsx
	return (
		<View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
			<Text style={{ color: colors.textPrimary }}>MapScreen restore pending — apply artifacts/MapScreen.FULL.tsx</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
});
