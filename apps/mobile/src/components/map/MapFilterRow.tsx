// NEXA map chrome: search nearby, semantic layers, filters and recenter.
// Map remains the product; controls are compact, spatial and theme-semantic.

import React, { useCallback, useMemo, useState } from 'react';
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

import type { DiscoveryRankBy, EntityKind, ListingMode } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

import {
	MAP_LAYER_ROW_HEIGHT,
	MAP_SEARCH_BAR_HEIGHT,
} from './mapChromeLayout';

export type ListingModeFilterValue = 'all' | ListingMode;

/** Cold-start layers — People only; Events/Listings are intentional toggles. */
export const DEFAULT_MAP_LAYERS: EntityKind[] = ['user'];

type LayerOption = {
	id: EntityKind;
	label: string;
	a11y: string;
	icon: string;
};

const LAYER_OPTIONS: LayerOption[] = [
	{ id: 'user', label: 'People', a11y: 'People layer', icon: 'account-outline' },
	{ id: 'event', label: 'Events', a11y: 'Events layer', icon: 'calendar-blank-outline' },
	{ id: 'listing', label: 'Listings', a11y: 'Listings layer', icon: 'tag-outline' },
];

const LISTING_OPTIONS: Array<{ id: ListingModeFilterValue; label: string }> = [
	{ id: 'all', label: 'All listings' },
	{ id: 'sell', label: 'For sale' },
	{ id: 'buy', label: 'Wanted' },
];

const SORT_OPTIONS: Array<{ id: DiscoveryRankBy; label: string }> = [
	{ id: 'relevance', label: 'Relevant' },
	{ id: 'distance', label: 'Nearest' },
	{ id: 'newest', label: 'Newest' },
];

export interface MapFilterRowProps {
	/** Search is scoped to the currently loaded viewport entities. */
	value: string;
	onChangeText: (text: string) => void;
	/** Active discovery layers (at least one). */
	layers: EntityKind[];
	onLayersChange: (next: EntityKind[]) => void;
	listingMode: ListingModeFilterValue;
	onListingModeChange: (next: ListingModeFilterValue) => void;
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

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function MapFilterRow({
	value,
	onChangeText,
	layers,
	onLayersChange,
	listingMode,
	onListingModeChange,
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
	const { colors: c } = useAppTheme();
	const [moreOpen, setMoreOpen] = useState(false);
	const [searchFocused, setSearchFocused] = useState(false);
	const showPeople = layers.includes('user');
	const showListings = layers.includes('listing');

	const activeAdvancedFilterCount = useMemo(() => {
		let count = 0;
		if (friendsOnly) count += 1;
		if (datingOnly) count += 1;
		if (rankBy !== 'relevance') count += 1;
		if (showListings && listingMode !== 'all') count += 1;
		return count;
	}, [datingOnly, friendsOnly, listingMode, rankBy, showListings]);

	const toggleLayer = useCallback(
		(id: EntityKind) => {
			if (layers.includes(id)) {
				if (layers.length <= 1) return;
				onLayersChange(layers.filter((kind) => kind !== id));
				return;
			}
			onLayersChange([...layers, id]);
		},
		[layers, onLayersChange],
	);

	const openAlerts = useCallback((): void => {
		setMoreOpen(false);
		navigation.navigate('AlertComposer', { presetCategory: 'general' });
	}, [navigation]);

	const recenterMap = useCallback((): void => {
		navigation.navigate('Main', {
			screen: 'Map',
			params: { focusMyPin: true },
		});
	}, [navigation]);

	const layerTone = useCallback(
		(id: EntityKind): string => {
			if (id === 'event') return c.entityEvent;
			if (id === 'listing') return c.entityListing;
			return c.entityPerson;
		},
		[c.entityEvent, c.entityListing, c.entityPerson],
	);

	const layerFill = useCallback(
		(id: EntityKind): string => {
			if (id === 'event') return c.discoverySoft;
			if (id === 'listing') return c.surfaceSecondary;
			return c.actionSoft;
		},
		[c.actionSoft, c.discoverySoft, c.surfaceSecondary],
	);

	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<View
				style={[
					styles.searchShell,
					{
						backgroundColor: c.surfacePrimary,
						borderColor: searchFocused ? c.discovery : c.borderStrong,
					},
				]}
			>
				<Icon name="magnify" size={20} color={searchFocused ? c.discovery : c.textTertiary} />
				<TextInput
					value={value}
					onChangeText={onChangeText}
					onFocus={() => setSearchFocused(true)}
					onBlur={() => setSearchFocused(false)}
					placeholder={placeholder}
					placeholderTextColor={c.textTertiary}
					selectionColor={c.discovery}
					style={[styles.searchInput, { color: c.textPrimary }]}
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
						<Icon name="close-circle" size={19} color={c.textTertiary} />
					</Pressable>
				) : null}
			</View>

			<View style={styles.controlRow}>
				<ScrollView
					horizontal
					style={styles.layerScroll}
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.layerContent}
					keyboardShouldPersistTaps="handled"
				>
					{LAYER_OPTIONS.map((option) => {
						const active = layers.includes(option.id);
						const tone = layerTone(option.id);
						return (
							<Pressable
								key={option.id}
								onPress={() => toggleLayer(option.id)}
								style={({ pressed }) => [
									styles.layerChip,
									{
										backgroundColor: active ? layerFill(option.id) : c.surfacePrimary,
										borderColor: active ? tone : c.borderDefault,
									},
									pressed && styles.pressed,
								]}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
								accessibilityLabel={option.a11y}
							>
								<Icon name={option.icon} size={17} color={active ? tone : c.textSecondary} />
								<Text style={[styles.layerText, { color: active ? tone : c.textSecondary }]}>
									{option.label}
								</Text>
							</Pressable>
						);
					})}
				</ScrollView>

				<View style={styles.fixedControls}>
					<Pressable
						onPress={() => setMoreOpen(true)}
						style={({ pressed }) => [
							styles.iconButton,
							{
								backgroundColor:
									activeAdvancedFilterCount > 0 ? c.actionSoft : c.surfacePrimary,
								borderColor:
									activeAdvancedFilterCount > 0 ? c.actionPrimary : c.borderDefault,
							},
							pressed && styles.pressed,
						]}
						accessibilityRole="button"
						accessibilityLabel={
							activeAdvancedFilterCount > 0
								? `Map filters, ${activeAdvancedFilterCount} active`
								: 'Map filters'
						}
					>
						<Icon
							name="tune-variant"
							size={19}
							color={activeAdvancedFilterCount > 0 ? c.actionPrimary : c.textSecondary}
						/>
						{activeAdvancedFilterCount > 0 ? (
							<View style={[styles.filterBadge, { backgroundColor: c.actionPrimary }]}>
								<Text style={[styles.filterBadgeText, { color: c.onPrimary }]}> 
									{activeAdvancedFilterCount}
								</Text>
							</View>
						) : null}
					</Pressable>

					<Pressable
						onPress={recenterMap}
						style={({ pressed }) => [
							styles.iconButton,
							{
								backgroundColor: c.discoverySoft,
								borderColor: c.discoveryBorder,
							},
							pressed && styles.pressed,
						]}
						accessibilityRole="button"
						accessibilityLabel="Center map on my location"
					>
						<Icon name="crosshairs-gps" size={20} color={c.discovery} />
					</Pressable>
				</View>
			</View>

			<Modal
				visible={moreOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setMoreOpen(false)}
			>
				<Pressable
					style={styles.modalBackdrop}
					onPress={() => setMoreOpen(false)}
					accessibilityRole="button"
					accessibilityLabel="Dismiss filters"
				>
					<Pressable
						style={[
							styles.modalCard,
							{ backgroundColor: c.surfacePrimary, borderColor: c.borderStrong },
						]}
						onPress={(event) => event.stopPropagation()}
					>
						<Text style={[styles.modalTitle, { color: c.textPrimary }]}>Map filters</Text>
						<Text style={[styles.modalSubtitle, { color: c.textTertiary }]}>
							Refine what NEXA shows in this area.
						</Text>

						<Text style={[styles.modalSection, { color: c.textTertiary }]}>Sort</Text>
						{SORT_OPTIONS.map((option) => {
							const active = rankBy === option.id;
							return (
								<Pressable
									key={option.id}
									onPress={() => onRankByChange(option.id)}
									style={({ pressed }) => [
										styles.modalRow,
										{ borderColor: active ? c.actionBorder : c.borderDefault },
										active && { backgroundColor: c.actionSoft },
										pressed && styles.pressed,
									]}
									accessibilityRole="button"
									accessibilityState={{ selected: active }}
								>
									<Text style={[styles.modalRowText, { color: active ? c.actionPrimary : c.textPrimary }]}>
										{option.label}
									</Text>
									{active ? <Icon name="check" size={18} color={c.actionPrimary} /> : null}
								</Pressable>
							);
						})}

						{showPeople ? (
							<>
								<Text style={[styles.modalSection, { color: c.textTertiary }]}>People</Text>
								<Pressable
									onPress={() => {
										onFriendsOnlyChange(!friendsOnly);
										if (!friendsOnly) onDatingOnlyChange(false);
									}}
									style={({ pressed }) => [
										styles.modalRow,
										{ borderColor: friendsOnly ? c.entityPerson : c.borderDefault },
										friendsOnly && { backgroundColor: c.actionSoft },
										pressed && styles.pressed,
									]}
									accessibilityRole="button"
									accessibilityState={{ selected: friendsOnly }}
								>
									<Text style={[styles.modalRowText, { color: friendsOnly ? c.entityPerson : c.textPrimary }]}>
										Friends only
									</Text>
									{friendsOnly ? <Icon name="check" size={18} color={c.entityPerson} /> : null}
								</Pressable>

								<Pressable
									onPress={() => {
										onDatingOnlyChange(!datingOnly);
										if (!datingOnly) onFriendsOnlyChange(false);
									}}
									style={({ pressed }) => [
										styles.modalRow,
										{ borderColor: datingOnly ? c.entityPerson : c.borderDefault },
										datingOnly && { backgroundColor: c.actionSoft },
										pressed && styles.pressed,
									]}
									accessibilityRole="button"
									accessibilityState={{ selected: datingOnly }}
								>
									<Text style={[styles.modalRowText, { color: datingOnly ? c.entityPerson : c.textPrimary }]}>
										Dating
									</Text>
									{datingOnly ? <Icon name="check" size={18} color={c.entityPerson} /> : null}
								</Pressable>
							</>
						) : null}

						{showListings ? (
							<>
								<Text style={[styles.modalSection, { color: c.textTertiary }]}>Listings</Text>
								{LISTING_OPTIONS.map((option) => {
									const active = listingMode === option.id;
									return (
										<Pressable
											key={option.id}
											onPress={() => onListingModeChange(option.id)}
											style={({ pressed }) => [
												styles.modalRow,
												{ borderColor: active ? c.entityListing : c.borderDefault },
												active && { backgroundColor: c.surfaceSecondary },
												pressed && styles.pressed,
											]}
											accessibilityRole="button"
											accessibilityState={{ selected: active }}
										>
											<Text style={[styles.modalRowText, { color: active ? c.entityListing : c.textPrimary }]}>
												{option.label}
											</Text>
											{active ? <Icon name="check" size={18} color={c.entityListing} /> : null}
										</Pressable>
									);
								})}
							</>
						) : null}

						<Text style={[styles.modalSection, { color: c.textTertiary }]}>Local</Text>
						<Pressable
							onPress={openAlerts}
							style={({ pressed }) => [
								styles.modalRow,
								{ borderColor: c.discoveryBorder },
								pressed && styles.pressed,
							]}
							accessibilityRole="button"
							accessibilityLabel="Create a local alert"
						>
							<View style={styles.modalActionLabel}>
								<Icon name="bell-outline" size={18} color={c.discovery} />
								<Text style={[styles.modalRowText, { color: c.textPrimary }]}>Local alerts</Text>
							</View>
							<Icon name="chevron-right" size={18} color={c.textTertiary} />
						</Pressable>

						<Pressable
							style={({ pressed }) => [
								styles.modalDone,
								{ backgroundColor: c.actionPrimary },
								pressed && styles.pressed,
							]}
							onPress={() => setMoreOpen(false)}
							accessibilityRole="button"
							accessibilityLabel="Done"
						>
							<Text style={[styles.modalDoneText, { color: c.onPrimary }]}>Done</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: spacing.md,
		right: spacing.md,
		zIndex: 30,
		gap: 8,
	},
	searchShell: {
		height: MAP_SEARCH_BAR_HEIGHT,
		borderRadius: radius.xl,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		paddingLeft: 14,
		paddingRight: 8,
		gap: 9,
		shadowColor: '#000000',
		shadowOpacity: 0.18,
		shadowRadius: 10,
		shadowOffset: { width: 0, height: 4 },
		elevation: 5,
	},
	searchInput: {
		flex: 1,
		height: '100%',
		fontSize: fontSize.md,
		fontWeight: '600',
		paddingVertical: 0,
	},
	clearButton: {
		width: 36,
		height: 36,
		alignItems: 'center',
		justifyContent: 'center',
		borderRadius: 18,
	},
	controlRow: {
		height: MAP_LAYER_ROW_HEIGHT,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	layerScroll: {
		flex: 1,
	},
	layerContent: {
		alignItems: 'center',
		gap: 8,
		paddingRight: 2,
	},
	layerChip: {
		height: 44,
		minWidth: 44,
		paddingHorizontal: 13,
		borderRadius: radius.pill,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 7,
	},
	layerText: {
		fontSize: fontSize.sm,
		fontWeight: '700',
	},
	fixedControls: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	iconButton: {
		width: 44,
		height: 44,
		borderRadius: 22,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
		position: 'relative',
	},
	filterBadge: {
		position: 'absolute',
		right: -2,
		top: -2,
		minWidth: 16,
		height: 16,
		paddingHorizontal: 3,
		borderRadius: 8,
		alignItems: 'center',
		justifyContent: 'center',
	},
	filterBadgeText: {
		fontSize: 9,
		lineHeight: 11,
		fontWeight: '800',
		textAlign: 'center',
	},
	pressed: {
		opacity: 0.72,
		transform: [{ scale: 0.97 }],
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.68)',
		justifyContent: 'center',
		padding: spacing.xl,
	},
	modalCard: {
		borderRadius: radius.xl,
		borderWidth: 1,
		padding: spacing.lg,
		maxHeight: '86%',
	},
	modalTitle: {
		fontSize: fontSize.lg,
		fontWeight: '800',
	},
	modalSubtitle: {
		fontSize: fontSize.sm,
		lineHeight: 19,
		marginTop: 4,
		marginBottom: spacing.xs,
	},
	modalSection: {
		fontSize: fontSize.xs,
		fontWeight: '800',
		textTransform: 'uppercase',
		letterSpacing: 0.8,
		marginTop: spacing.md,
		marginBottom: 6,
	},
	modalRow: {
		minHeight: 44,
		paddingHorizontal: 12,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginBottom: 6,
	},
	modalRowText: {
		fontSize: fontSize.sm,
		fontWeight: '600',
	},
	modalActionLabel: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
	},
	modalDone: {
		marginTop: spacing.lg,
		minHeight: 44,
		borderRadius: radius.pill,
		alignItems: 'center',
		justifyContent: 'center',
	},
	modalDoneText: {
		fontSize: fontSize.sm,
		fontWeight: '800',
	},
});
