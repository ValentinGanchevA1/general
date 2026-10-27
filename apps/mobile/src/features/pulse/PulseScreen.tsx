// apps/mobile/src/features/pulse/PulseScreen.tsx
import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { appAlert } from '@/ui/appAlert';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { ActivityItem, ActivityType, StoryCard, Viewport } from '@g88/shared';
import { canPostStory, storyGateMessage } from '@g88/shared';
import type { PulseFilter, RootStackParamList, TabParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import {
	clearCheckInError,
	clearPendingFilter,
	createPulseCheckIn,
	fetchFeed,
} from './pulseSlice';
import { useUserLocation } from '@/features/location/useUserLocation';
import { fetchNearbyStories, storyReceived } from '@/features/stories/storiesSlice';
import { PulseStrip } from '@/features/stories/components/PulseStrip';
import { spacing, useAppTheme, type ThemeColors } from '@/theme';
import { EmptyState } from '@/components/EmptyState';
import { AppChip } from '@/components/ui';
import { StoryViewer } from '@/features/stories/components/StoryViewer';
import { StoryCreateSheet } from '@/features/stories/components/StoryCreateSheet';
import { pickAndUploadStoryMedia } from '@/features/stories/storyMedia';
import { useSocket } from '@/realtime/useSocket';
import { track } from '@/lib/analytics';
import { ActivityCard } from './components/ActivityCard';
import { CheckInSheet, type CheckInDraft } from './components/CheckInSheet';
import { NearbyPeopleStrip } from './components/NearbyPeopleStrip';
import { TrendingStrip } from './components/TrendingStrip';
import { useTrendingNearby } from './useTrendingNearby';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type R = RouteProp<TabParamList, 'Pulse'>;

interface FilterDef { key: PulseFilter; label: string; type: ActivityType | null; }
const FILTERS: readonly FilterDef[] = [
	{ key: 'for-you', label: 'For You', type: null },
	{ key: 'nearby', label: 'Nearby', type: null },
	{ key: 'events', label: 'Events', type: 'event' },
	{ key: 'marketplace', label: 'Marketplace', type: 'listing' },
];
const ALLOWED_FILTER_KEYS = new Set<PulseFilter>(FILTERS.map((filter) => filter.key));
function resolveFilter(raw: unknown): PulseFilter { return typeof raw === 'string' && ALLOWED_FILTER_KEYS.has(raw as PulseFilter) ? (raw as PulseFilter) : 'for-you'; }
function viewportAround(lat: number, lng: number, delta = 0.02): Viewport { return { ne: { lat: lat + delta / 2, lng: lng + delta / 2 }, sw: { lat: lat - delta / 2, lng: lng - delta / 2 } }; }
type EmptyActionKind = 'story' | 'map' | 'verify_email' | 'verify_phone';

export function PulseScreen(): React.JSX.Element {
	const { colors } = useAppTheme();
	const S = useMemo(() => createStyles(colors), [colors]);
	const dispatch = useAppDispatch();
	const navigation = useNavigation<Nav>();
	const route = useRoute<R>();
	const {
		items,
		loading,
		error,
		pendingFilter,
		checkInSubmitting,
		checkInError,
	} = useAppSelector((state) => state.pulse);
	const discoveryPoints = useAppSelector((state) => state.discovery.points);
	const nearbyStories = useAppSelector((state) => state.stories.nearby);
	const profile = useAppSelector((state) => state.profile.profile);
	const { topics: trendingTopics } = useTrendingNearby();
	const { coords: myCoords, requestPermission } = useUserLocation();
	const { on } = useSocket();
	const [filter, setFilter] = useState<PulseFilter>(() => resolveFilter(route.params?.filter));
	const [viewerOpen, setViewerOpen] = useState(false);
	const [viewerIndex, setViewerIndex] = useState(0);
	const [createOpen, setCreateOpen] = useState(false);
	const [checkInOpen, setCheckInOpen] = useState(false);
	const [trendingCollapsed, setTrendingCollapsed] = useState(true);
	const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };

	useEffect(() => { if (route.params?.filter == null) return; let active = true; void Promise.resolve().then(() => { if (active) setFilter(resolveFilter(route.params?.filter)); }); return () => { active = false; }; }, [route.params?.filter]);
	useEffect(() => { if (!pendingFilter) return; let active = true; void Promise.resolve().then(() => { if (!active) return; setFilter(resolveFilter(pendingFilter)); dispatch(clearPendingFilter()); }); return () => { active = false; }; }, [pendingFilter, dispatch]);
	const load = useCallback(() => { const definition = FILTERS.find((candidate) => candidate.key === filter); void dispatch(fetchFeed(definition?.type ? { types: [definition.type] } : {})); }, [dispatch, filter]);
	const loadStories = useCallback(() => { if (!myCoords) return; void dispatch(fetchNearbyStories({ viewport: viewportAround(myCoords.lat, myCoords.lng), zoom: 14 })); }, [dispatch, myCoords]);
	useFocusEffect(useCallback(() => { void requestPermission(); load(); loadStories(); }, [requestPermission, load, loadStories]));
	useEffect(() => on('story:new', (event) => { dispatch(storyReceived(event)); }), [on, dispatch]);
	const filtered = useMemo(() => { const definition = FILTERS.find((candidate) => candidate.key === filter); let next = definition?.type ? items.filter((item) => item.type === definition.type) : items; if (filter === 'nearby') next = [...next].sort((left, right) => (left.distanceM ?? Number.POSITIVE_INFINITY) - (right.distanceM ?? Number.POSITIVE_INFINITY) || Date.parse(right.createdAt) - Date.parse(left.createdAt)); return next; }, [items, filter]);
	const onTap = useCallback((item: ActivityItem): void => { const { screen, params } = item.deepLink; if (screen === 'ListingDetail') { openRootScreen(navigation, 'ListingDetail', params); return; } if (screen === 'EventDetail') { openRootScreen(navigation, 'EventDetail', params); return; } if (screen === 'Main') { navigation.navigate('Main', params as never); return; } (navigation.navigate as (screenName: string, screenParams?: object) => void)(screen, params); }, [navigation]);
	const storyEligibility = useMemo(() => { if (!profile) return { allowed: false as const, reason: 'email_unverified' as const }; return canPostStory({ verification: profile.verification, createdAt: profile.createdAt, strikePoints: profile.strikePoints ?? 0, storySuspendedUntil: profile.storySuspendedUntil ?? null }); }, [profile]);
	const onOpenStory = useCallback((story: StoryCard, index: number) => { setViewerIndex(index); setViewerOpen(true); track('story.open', { storyId: story.id, index, surface: 'pulse' }); }, []);
	const onCreatePress = useCallback(() => { if (!storyEligibility.allowed) { const reason = storyEligibility.reason; track('story.gate_tap', { reason, surface: 'pulse' }); if (reason === 'email_unverified') { openRootScreen(navigation, 'EmailVerification'); return; } if (reason === 'phone_required') { openRootScreen(navigation, 'Verification', { initialPhone: profile?.phone ?? undefined }); return; } appAlert('Stories', storyGateMessage(reason), [{ text: 'OK' }]); return; } setCreateOpen(true); track('story.create_open', { surface: 'pulse' }); }, [storyEligibility, navigation, profile?.phone]);
	const onOpenCheckIn = useCallback(() => {
		dispatch(clearCheckInError());
		setCheckInOpen(true);
		void requestPermission();
		track('pulse.check_in_open', { surface: 'pulse' });
	}, [dispatch, requestPermission]);
	const onCloseCheckIn = useCallback(() => {
		if (checkInSubmitting) return;
		setCheckInOpen(false);
		dispatch(clearCheckInError());
	}, [checkInSubmitting, dispatch]);
	const onSubmitCheckIn = useCallback((draft: CheckInDraft): void => {
		if (!myCoords) {
			void requestPermission();
			return;
		}
		void dispatch(createPulseCheckIn({
			placeLabel: draft.placeLabel,
			audience: draft.audience,
			lat: myCoords.lat,
			lng: myCoords.lng,
		})).unwrap().then(() => {
			setCheckInOpen(false);
			track('pulse.check_in_created', { audience: draft.audience });
			load();
		}).catch(() => undefined);
	}, [dispatch, load, myCoords, requestPermission]);
	const emptyCopy = useMemo(() => { if (filter === 'events') return { icon: 'calendar-outline', title: 'No nearby events', body: 'New local events will appear here as they are published.', actionLabel: 'Open map', actionKind: 'map' as EmptyActionKind }; if (filter === 'marketplace') return { icon: 'storefront-outline', title: 'Nothing for sale nearby', body: 'Local marketplace listings will appear here.', actionLabel: 'Open map', actionKind: 'map' as EmptyActionKind }; if (filter === 'nearby') return { icon: 'map-marker-radius-outline', title: 'Quiet nearby', body: 'No local check-ins, alerts, events or listings are close enough yet.', actionLabel: 'Open map', actionKind: 'map' as EmptyActionKind }; if (!storyEligibility.allowed) { const reason = storyEligibility.reason; if (reason === 'email_unverified') return { icon: 'email-check-outline', title: 'Quiet around here', body: 'Verify your email to post a story and join the local pulse.', actionLabel: 'Verify email', actionKind: 'verify_email' as EmptyActionKind }; if (reason === 'phone_required') return { icon: 'cellphone-check', title: 'Quiet around here', body: 'Add a phone number to unlock stories after recent strikes.', actionLabel: 'Add phone', actionKind: 'verify_phone' as EmptyActionKind }; return { icon: 'pulse', title: 'Quiet around here', body: storyGateMessage(reason), actionLabel: 'Open map', actionKind: 'map' as EmptyActionKind }; } return { icon: 'pulse', title: 'Quiet around here', body: 'Local check-ins, alerts, events and marketplace activity will appear here.', actionLabel: 'Add story', actionKind: 'story' as EmptyActionKind }; }, [filter, storyEligibility]);
	const onEmptyAction = useCallback(() => { if (emptyCopy.actionKind === 'story') onCreatePress(); else if (emptyCopy.actionKind === 'verify_email') openRootScreen(navigation, 'EmailVerification'); else if (emptyCopy.actionKind === 'verify_phone') openRootScreen(navigation, 'Verification', { initialPhone: profile?.phone ?? undefined }); else navigation.navigate('Main', { screen: 'Map' } as never); }, [emptyCopy.actionKind, onCreatePress, navigation, profile?.phone]);

	const Header = <View><View style={[S.headerBar, { paddingTop: Math.max(insets.top, 8) + 8 }]}><Text style={S.headerTitle}>Pulse</Text><TouchableOpacity style={S.checkInButton} onPress={onOpenCheckIn} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel="Check in nearby"><Text style={S.checkInButtonText}>Check in</Text></TouchableOpacity></View><PulseStrip onOpenStory={onOpenStory} onCreatePress={onCreatePress} canCreate={storyEligibility.allowed} {...(!storyEligibility.allowed ? { gateReason: storyEligibility.reason } : {})} /><ScrollView horizontal showsHorizontalScrollIndicator={false} style={S.chips} contentContainerStyle={S.chipsContent}>{FILTERS.map((definition) => <AppChip key={definition.key} label={definition.label} selected={filter === definition.key} onPress={() => setFilter(definition.key)} accessibilityLabel={`Filter ${definition.label}`} style={S.chip} />)}</ScrollView><NearbyPeopleStrip points={discoveryPoints} onTapUser={(userId) => navigation.navigate('UserProfile', { userId })} /></View>;
	const Footer = <View style={S.footer}><TrendingStrip topics={trendingTopics} collapsed={trendingCollapsed && filtered.length > 0} onToggleCollapse={() => setTrendingCollapsed((collapsed) => !collapsed)} onTapTopic={(topic) => navigation.navigate('AlertComposer', { presetCategory: 'general', presetTag: topic })} /></View>;
	const overlays = <><StoryViewer stories={nearbyStories} initialIndex={viewerIndex} visible={viewerOpen} onClose={() => setViewerOpen(false)} /><StoryCreateSheet visible={createOpen} onClose={() => setCreateOpen(false)} location={myCoords} pickAndUpload={pickAndUploadStoryMedia} /><CheckInSheet visible={checkInOpen} submitting={checkInSubmitting} error={checkInError} locationReady={myCoords != null} onClose={onCloseCheckIn} onSubmit={onSubmitCheckIn} /></>;

	if (loading && items.length === 0) return <View style={S.container}>{Header}<View style={S.center}><ActivityIndicator color={colors.primary} /></View>{overlays}</View>;
	if (error && items.length === 0) return <View style={S.container}>{Header}<View style={S.center}><Text style={S.errorText}>{error}</Text><TouchableOpacity onPress={load} style={S.retry}><Text style={S.retryText}>Retry</Text></TouchableOpacity></View>{overlays}</View>;
	return <View style={S.container}><FlatList data={filtered} keyExtractor={(item) => item.id} renderItem={({ item }) => <ActivityCard item={item} onPress={() => onTap(item)} onView={() => onTap(item)} />} ListHeaderComponent={Header} ListFooterComponent={Footer} ListEmptyComponent={<View style={S.emptyWrap}><EmptyState variant="plain" icon={emptyCopy.icon} title={emptyCopy.title} body={emptyCopy.body} actionLabel={emptyCopy.actionLabel} onAction={onEmptyAction} /></View>} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { load(); loadStories(); }} tintColor={colors.primary} colors={[colors.primary]} progressBackgroundColor={colors.surfaceRaised} />} contentContainerStyle={{ paddingBottom: 100 + Math.max(insets.bottom, 8) }} />{overlays}</View>;
}

function createStyles(colors: ThemeColors) {
	return StyleSheet.create({
		container: { flex: 1, backgroundColor: colors.bg },
		headerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 2 },
		headerTitle: { color: colors.textPrimary, fontSize: 26, fontWeight: '700', flex: 1 },
		checkInButton: { minHeight: 38, justifyContent: 'center', paddingHorizontal: 13, borderRadius: 12, backgroundColor: colors.actionGhost, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.actionPrimary },
		checkInButtonText: { color: colors.actionPrimary, fontSize: 13, fontWeight: '700' },
		chips: { maxHeight: 44 },
		chipsContent: { paddingHorizontal: 12, paddingVertical: 6, gap: 8 },
		chip: { marginRight: 0 },
		center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
		errorText: { color: colors.danger, fontSize: 14, marginBottom: 12, textAlign: 'center' },
		retry: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
		retryText: { color: colors.onPrimary, fontWeight: '700' },
		emptyWrap: { paddingTop: spacing.xl, paddingHorizontal: spacing.sm },
		footer: { paddingTop: 8, paddingBottom: 16 },
	});
}
