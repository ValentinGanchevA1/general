// NEXA primary map chrome: search + locate, semantic layers + private saved overlay.
// Keep high-frequency controls visible without horizontal scrolling or duplicate floating actions.

import React, { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import {
	Modal,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type {
	DiscoveryRankBy,
	EntityKind,
	ListingMode,
	MarketplaceKind,
} from '@g88/shared';
import { NexaEntityGlyph } from '@/components/Brand/NexaEntityGlyph';
import { savedPlacesMapLayerStore } from '@/features/places/savedPlacesMapLayer.store';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';
import { MAP_LAYER_ROW_HEIGHT, MAP_SEARCH_BAR_HEIGHT } from './mapChromeLayout';

export type ListingModeFilterValue = 'all' | ListingMode;
export type MarketplaceKindFilterValue = 'all' | MarketplaceKind;
export const DEFAULT_MAP_LAYERS: EntityKind[] = ['user'];

type LayerOption = { id: EntityKind; label: string; a11y: string };
type Choice<T extends string> = { id: T; label: string };
type Nav = NativeStackNavigationProp<RootStackParamList>;
type Styles = ReturnType<typeof createStyles>;

const LAYER_OPTIONS: LayerOption[] = [
	{ id: 'user', label: 'People', a11y: 'People layer' },
	{ id: 'event', label: 'Events', a11y: 'Events layer' },
	{ id: 'listing', label: 'Listings', a11y: 'Listings layer' },
];

const LISTING_OPTIONS: Choice<ListingModeFilterValue>[] = [
	{ id: 'all', label: 'All listings' },
	{ id: 'sell', label: 'For sale' },
	{ id: 'buy', label: 'Wanted' },
];

const MARKETPLACE_KIND_OPTIONS: Choice<MarketplaceKindFilterValue>[] = [
	{ id: 'all', label: 'All types' },
	{ id: 'for_sale', label: 'For sale items' },
	{ id: 'service', label: 'Services' },
	{ id: 'job', label: 'Jobs' },
	{ id: 'local_deal', label: 'Local deals' },
];

const SORT_OPTIONS: Choice<DiscoveryRankBy>[] = [
	{ id: 'relevance', label: 'Relevant' },
	{ id: 'distance', label: 'Nearest' },
	{ id: 'newest', label: 'Newest' },
];

export interface MapFilterRowProps {
	value: string;
	onChangeText: (text: string) => void;
	layers: EntityKind[];
	onLayersChange: (next: EntityKind[]) => void;
	listingMode: ListingModeFilterValue;
	onListingModeChange: (next: ListingModeFilterValue) => void;
	marketplaceKind: MarketplaceKindFilterValue;
	onMarketplaceKindChange: (next: MarketplaceKindFilterValue) => void;
	friendsOnly: boolean;
	onFriendsOnlyChange: (next: boolean) => void;
	datingOnly: boolean;
	onDatingOnlyChange: (next: boolean) => void;
	rankBy: DiscoveryRankBy;
	onRankByChange: (next: DiscoveryRankBy) => void;
	/** Retained for API compatibility; create is owned by the center tab. */
	onPressCreate: () => void;
	top: number;
	placeholder?: string;
}

export function MapFilterRow({
	value,
	onChangeText,
	layers,
	onLayersChange,
	listingMode,
	onListingModeChange,
	marketplaceKind,
	onMarketplaceKindChange,
	friendsOnly,
	onFriendsOnlyChange,
	datingOnly,
	onDatingOnlyChange,
	rankBy,
	onRankByChange,
	top,
	placeholder = 'Search nearby',
}: MapFilterRowProps): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const { colors, shadow } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const [moreOpen, setMoreOpen] = useState(false);
	const [searchFocused, setSearchFocused] = useState(false);
	const savedPlacesEnabled = useSyncExternalStore(
		savedPlacesMapLayerStore.subscribe,
		savedPlacesMapLayerStore.getSnapshot,
		savedPlacesMapLayerStore.getSnapshot,
	);
	const showPeople = layers.includes('user');
	const showListings = layers.includes('listing');

	const activeAdvancedFilterCount = useMemo(() => {
		let count = 0;
		if (friendsOnly) count += 1;
		if (datingOnly) count += 1;
		if (rankBy !== 'relevance') count += 1;
		if (showListings && marketplaceKind !== 'all') count += 1;
		else if (showListings && listingMode !== 'all') count += 1;
		return count;
	}, [datingOnly, friendsOnly, listingMode, marketplaceKind, rankBy, showListings]);

	const changeListingMode = useCallback((next: ListingModeFilterValue): void => {
		onListingModeChange(next);
		// Mode choices are broad; clear any narrower sell-side taxonomy.
		onMarketplaceKindChange('all');
	}, [onListingModeChange, onMarketplaceKindChange]);

	const changeMarketplaceKind = useCallback((next: MarketplaceKindFilterValue): void => {
		onMarketplaceKindChange(next);
		if (next !== 'all') {
			// Marketplace kinds are sell-side taxonomy; Wanted is a separate buy intent.
			onListingModeChange('sell');
		}
	}, [onListingModeChange, onMarketplaceKindChange]);

	const toggleLayer = useCallback((id: EntityKind): void => {
		if (layers.includes(id)) {
			if (layers.length === 1) return;
			onLayersChange(layers.filter((kind) => kind !== id));
			return;
		}
		onLayersChange([...layers, id]);
	}, [layers, onLayersChange]);

	const recenterMap = useCallback((): void => {
		navigation.navigate('Main', { screen: 'Map', params: { focusMyPin: true } });
	}, [navigation]);

	const openAlerts = useCallback((): void => {
		setMoreOpen(false);
		navigation.navigate('AlertComposer', { presetCategory: 'general' });
	}, [navigation]);

	const layerTone = useCallback((id: EntityKind): string => {
		if (id === 'event') return colors.entityEvent;
		if (id === 'listing') return colors.entityListing;
		return colors.entityPerson;
	}, [colors.entityEvent, colors.entityListing, colors.entityPerson]);

	const layerFill = useCallback((id: EntityKind): string => {
		if (id === 'event') return colors.discoverySoft;
		if (id === 'listing') return colors.surfaceSecondary;
		return colors.actionSoft;
	}, [colors.actionSoft, colors.discoverySoft, colors.surfaceSecondary]);

	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<View style={styles.searchRow}>
				<View style={[
					styles.searchShell,
					shadow(0.12),
					{ borderColor: searchFocused ? colors.discovery : colors.borderStrong },
				]}>
					<Icon name="magnify" size={20} color={searchFocused ? colors.discovery : colors.textTertiary} />
					<TextInput
						value={value}
						onChangeText={onChangeText}
						onFocus={() => setSearchFocused(true)}
						onBlur={() => setSearchFocused(false)}
						placeholder={placeholder}
						placeholderTextColor={colors.textTertiary}
						selectionColor={colors.discovery}
						style={styles.searchInput}
						returnKeyType="search"
						autoCorrect={false}
						autoCapitalize="none"
						accessibilityLabel="Search nearby"
					/>
					{value.length > 0 ? (
						<Pressable
							onPress={() => onChangeText('')}
							style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
							accessibilityRole="button"
							accessibilityLabel="Clear nearby search"
						>
							<Icon name="close-circle" size={19} color={colors.textTertiary} />
						</Pressable>
					) : null}
				</View>

				<Pressable
					onPress={recenterMap}
					style={({ pressed }) => [styles.locateButton, shadow(0.1), pressed && styles.pressed]}
					accessibilityRole="button"
					accessibilityLabel="Center map on my location"
				>
					<Icon name="crosshairs-gps" size={20} color={colors.discovery} />
				</Pressable>
			</View>

			<View style={styles.controlRow}>
				<View style={styles.layers}>
					{LAYER_OPTIONS.map((option) => {
						const active = layers.includes(option.id);
						const tone = layerTone(option.id);
						const fill = layerFill(option.id);
						return (
							<Pressable
								key={option.id}
								onPress={() => toggleLayer(option.id)}
								style={({ pressed }) => [
									styles.layerChip,
									{ backgroundColor: active ? fill : colors.surfacePrimary, borderColor: active ? tone : colors.borderDefault },
									pressed && styles.pressed,
								]}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
								accessibilityLabel={option.a11y}
							>
								<NexaEntityGlyph
									kind={option.id === 'user' ? 'person' : option.id}
									size={16}
									color={active ? tone : colors.textSecondary}
									fillColor={active ? fill : 'transparent'}
									strokeWidth={1.6}
								/>
								<Text numberOfLines={1} style={[styles.layerText, { color: active ? tone : colors.textSecondary }]}>{option.label}</Text>
							</Pressable>
						);
					})}

					<Pressable
						onPress={() => savedPlacesMapLayerStore.setEnabled(!savedPlacesEnabled)}
						style={({ pressed }) => [
							styles.layerChip,
							{
								backgroundColor: savedPlacesEnabled ? colors.actionSoft : colors.surfacePrimary,
								borderColor: savedPlacesEnabled ? colors.actionPrimary : colors.borderDefault,
							},
							pressed && styles.pressed,
						]}
						accessibilityRole="button"
						accessibilityState={{ selected: savedPlacesEnabled }}
						accessibilityLabel="Saved places layer"
					>
						<Icon name={savedPlacesEnabled ? 'bookmark' : 'bookmark-outline'} size={15} color={savedPlacesEnabled ? colors.actionPrimary : colors.textSecondary} />
						<Text numberOfLines={1} style={[styles.layerText, { color: savedPlacesEnabled ? colors.actionPrimary : colors.textSecondary }]}>Saved</Text>
					</Pressable>
				</View>

				<Pressable
					onPress={() => setMoreOpen(true)}
					style={({ pressed }) => [
						styles.filterButton,
						activeAdvancedFilterCount > 0 && styles.filterButtonActive,
						pressed && styles.pressed,
					]}
					accessibilityRole="button"
					accessibilityLabel={activeAdvancedFilterCount > 0 ? `Map filters, ${activeAdvancedFilterCount} active` : 'Map filters'}
				>
					<Icon name="tune-variant" size={19} color={activeAdvancedFilterCount > 0 ? colors.actionPrimary : colors.textSecondary} />
					{activeAdvancedFilterCount > 0 ? (
						<View style={styles.filterBadge}><Text style={styles.filterBadgeText}>{activeAdvancedFilterCount}</Text></View>
					) : null}
				</Pressable>
			</View>

			<FilterModal
				visible={moreOpen}
				onClose={() => setMoreOpen(false)}
				colors={colors}
				styles={styles}
				rankBy={rankBy}
				onRankByChange={onRankByChange}
				showPeople={showPeople}
				friendsOnly={friendsOnly}
				datingOnly={datingOnly}
				onFriendsOnlyChange={onFriendsOnlyChange}
				onDatingOnlyChange={onDatingOnlyChange}
				showListings={showListings}
				listingMode={listingMode}
				onListingModeChange={changeListingMode}
				marketplaceKind={marketplaceKind}
				onMarketplaceKindChange={changeMarketplaceKind}
				onOpenAlerts={openAlerts}
			/>
		</View>
	);
}

interface FilterModalProps {
	visible: boolean;
	onClose: () => void;
	colors: ThemeColors;
	styles: Styles;
	rankBy: DiscoveryRankBy;
	onRankByChange: (next: DiscoveryRankBy) => void;
	showPeople: boolean;
	friendsOnly: boolean;
	datingOnly: boolean;
	onFriendsOnlyChange: (next: boolean) => void;
	onDatingOnlyChange: (next: boolean) => void;
	showListings: boolean;
	listingMode: ListingModeFilterValue;
	onListingModeChange: (next: ListingModeFilterValue) => void;
	marketplaceKind: MarketplaceKindFilterValue;
	onMarketplaceKindChange: (next: MarketplaceKindFilterValue) => void;
	onOpenAlerts: () => void;
}

function FilterModal(props: FilterModalProps): React.JSX.Element {
	const { colors, styles } = props;
	return (
		<Modal visible={props.visible} transparent animationType="fade" onRequestClose={props.onClose}>
			<Pressable style={styles.modalBackdrop} onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Dismiss filters">
				<Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
					<Text style={styles.modalTitle}>Map filters</Text>
					<Text style={styles.modalSubtitle}>Refine what NEXA shows in this area.</Text>
					<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalScroll}>
						<SectionLabel styles={styles}>Sort</SectionLabel>
						{SORT_OPTIONS.map((option) => (
							<ChoiceRow key={option.id} styles={styles} colors={colors} label={option.label} active={props.rankBy === option.id} onPress={() => props.onRankByChange(option.id)} />
						))}

						{props.showPeople ? <>
							<SectionLabel styles={styles}>People</SectionLabel>
							<ChoiceRow styles={styles} colors={colors} label="Friends only" active={props.friendsOnly} onPress={() => { props.onFriendsOnlyChange(!props.friendsOnly); if (!props.friendsOnly) props.onDatingOnlyChange(false); }} />
							<ChoiceRow styles={styles} colors={colors} label="Dating" active={props.datingOnly} onPress={() => { props.onDatingOnlyChange(!props.datingOnly); if (!props.datingOnly) props.onFriendsOnlyChange(false); }} />
						</> : null}

						{props.showListings ? <>
							<SectionLabel styles={styles}>Listings</SectionLabel>
							{LISTING_OPTIONS.map((option) => (
								<ChoiceRow key={option.id} styles={styles} colors={colors} label={option.label} active={props.listingMode === option.id} onPress={() => props.onListingModeChange(option.id)} />
							))}
							<SectionLabel styles={styles}>Marketplace type</SectionLabel>
							{MARKETPLACE_KIND_OPTIONS.map((option) => (
								<ChoiceRow key={option.id} styles={styles} colors={colors} label={option.label} active={props.marketplaceKind === option.id} onPress={() => props.onMarketplaceKindChange(option.id)} />
							))}
						</> : null}

						<SectionLabel styles={styles}>Local</SectionLabel>
						<Pressable onPress={props.onOpenAlerts} style={({ pressed }) => [styles.modalRow, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Create a local alert">
							<View style={styles.modalActionLabel}><Icon name="bell-outline" size={18} color={colors.discovery} /><Text style={styles.modalRowText}>Local alerts</Text></View>
							<Icon name="chevron-right" size={18} color={colors.textTertiary} />
						</Pressable>
					</ScrollView>
					<Pressable style={({ pressed }) => [styles.modalDone, pressed && styles.pressed]} onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Done">
						<Text style={styles.modalDoneText}>Done</Text>
					</Pressable>
				</Pressable>
			</Pressable>
		</Modal>
	);
}

function SectionLabel({ children, styles }: { children: string; styles: Styles }): React.JSX.Element {
	return <Text style={styles.modalSection}>{children}</Text>;
}

function ChoiceRow({ label, active, onPress, colors, styles }: { label: string; active: boolean; onPress: () => void; colors: ThemeColors; styles: Styles }): React.JSX.Element {
	return (
		<Pressable onPress={onPress} style={({ pressed }) => [styles.modalRow, active && styles.modalRowActive, pressed && styles.pressed]} accessibilityRole="button" accessibilityState={{ selected: active }}>
			<Text style={[styles.modalRowText, active && styles.modalRowTextActive]}>{label}</Text>
			{active ? <Icon name="check" size={18} color={colors.actionPrimary} /> : null}
		</Pressable>
	);
}

function createStyles(colors: ThemeColors) {
	return StyleSheet.create({
		wrap: { position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 30, gap: 8 },
		searchRow: { height: MAP_SEARCH_BAR_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 8 },
		searchShell: { flex: 1, height: MAP_SEARCH_BAR_HEIGHT, borderRadius: radius.xl, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 7, gap: 9, backgroundColor: colors.surfacePrimary },
		searchInput: { flex: 1, height: '100%', color: colors.textPrimary, fontSize: fontSize.md, fontWeight: '600', paddingVertical: 0 },
		clearButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17 },
		locateButton: { width: MAP_SEARCH_BAR_HEIGHT, height: MAP_SEARCH_BAR_HEIGHT, borderRadius: MAP_SEARCH_BAR_HEIGHT / 2, borderWidth: 1, borderColor: colors.discoveryBorder, backgroundColor: colors.discoverySoft, alignItems: 'center', justifyContent: 'center' },
		controlRow: { height: MAP_LAYER_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 8 },
		layers: { flex: 1, height: MAP_LAYER_ROW_HEIGHT, flexDirection: 'row', gap: 5 },
		layerChip: { flex: 1, minWidth: 0, height: MAP_LAYER_ROW_HEIGHT, paddingHorizontal: 4, borderRadius: radius.pill, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
		layerText: { flexShrink: 1, fontSize: 11, fontWeight: '700' },
		filterButton: { width: MAP_LAYER_ROW_HEIGHT, height: MAP_LAYER_ROW_HEIGHT, borderRadius: MAP_LAYER_ROW_HEIGHT / 2, borderWidth: 1, borderColor: colors.borderDefault, backgroundColor: colors.surfacePrimary, alignItems: 'center', justifyContent: 'center', position: 'relative' },
		filterButtonActive: { borderColor: colors.actionPrimary, backgroundColor: colors.actionSoft },
		filterBadge: { position: 'absolute', right: -2, top: -2, minWidth: 16, height: 16, paddingHorizontal: 3, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
		filterBadgeText: { color: colors.onPrimary, fontSize: 9, lineHeight: 11, fontWeight: '800', textAlign: 'center' },
		pressed: { opacity: 0.72, transform: [{ scale: 0.97 }] },
		modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.68)', justifyContent: 'center', padding: spacing.xl },
		modalCard: { maxHeight: '86%', borderRadius: radius.xl, borderWidth: 1, borderColor: colors.borderStrong, padding: spacing.lg, backgroundColor: colors.surfacePrimary },
		modalTitle: { color: colors.textPrimary, fontSize: fontSize.lg, fontWeight: '800' },
		modalSubtitle: { color: colors.textTertiary, fontSize: fontSize.sm, lineHeight: 19, marginTop: 4 },
		modalScroll: { paddingBottom: spacing.xs },
		modalSection: { color: colors.textTertiary, fontSize: fontSize.xs, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing.md, marginBottom: 6 },
		modalRow: { minHeight: 44, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderDefault, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
		modalRowActive: { borderColor: colors.actionBorder, backgroundColor: colors.actionSoft },
		modalRowText: { color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
		modalRowTextActive: { color: colors.actionPrimary },
		modalActionLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
		modalDone: { marginTop: spacing.md, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.actionPrimary },
		modalDoneText: { color: colors.onPrimary, fontSize: fontSize.sm, fontWeight: '800' },
	});
}
