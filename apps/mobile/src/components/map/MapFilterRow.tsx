// Map chrome: People · Events · Listings + search + sort + create (+) + More.
// Friends + listing mode live in the More sheet.

import React, { useCallback, useState } from 'react';
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

import type { DiscoveryRankBy, EntityKind, ListingMode } from '@g88/shared';
import { colors, fontSize, radius, spacing } from '@/theme';

import { COMBINED_FILTER_ROW_HEIGHT } from './mapChromeLayout';

export type ListingModeFilterValue = 'all' | ListingMode;

export const DEFAULT_MAP_LAYERS: EntityKind[] = ['user', 'event', 'listing'];

const LAYER_OPTIONS: Array<{ id: EntityKind; label: string; a11y: string }> = [
	{ id: 'user', label: 'People', a11y: 'People layer' },
	{ id: 'event', label: 'Events', a11y: 'Events layer' },
	{ id: 'listing', label: 'Listings', a11y: 'Listings layer' },
];

const LISTING_OPTIONS: Array<{ id: ListingModeFilterValue; label: string }> = [
	{ id: 'all', label: 'All listings' },
	{ id: 'sell', label: 'For sale' },
	{ id: 'buy', label: 'Wanted' },
];

const RANK_CYCLE: DiscoveryRankBy[] = ['relevance', 'distance', 'newest'];

function rankLabel(r: DiscoveryRankBy): string {
	if (r === 'distance') return 'Near';
	if (r === 'newest') return 'New';
	return 'Relevant';
}

function nextRank(current: DiscoveryRankBy): DiscoveryRankBy {
	const i = RANK_CYCLE.indexOf(current);
	return RANK_CYCLE[(i + 1) % RANK_CYCLE.length]!;
}

export interface MapFilterRowProps {
	value: string;
	onChangeText: (text: string) => void;
	/** Active discovery layers (at least one). */
	layers: EntityKind[];
	onLayersChange: (next: EntityKind[]) => void;
	listingMode: ListingModeFilterValue;
	onListingModeChange: (next: ListingModeFilterValue) => void;
	friendsOnly: boolean;
	onFriendsOnlyChange: (next: boolean) => void;
	rankBy: DiscoveryRankBy;
	onRankByChange: (next: DiscoveryRankBy) => void;
	/** Opens create-nearby sheet (sell / wanted / event / alert). */
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
	friendsOnly,
	onFriendsOnlyChange,
	rankBy,
	onRankByChange,
	onPressCreate,
	top,
	placeholder = 'Search this area…',
}: MapFilterRowProps): React.JSX.Element {
	const rankActive = rankBy !== 'relevance';
	const showPeople = layers.includes('user');
	const showListings = layers.includes('listing');
	const [moreOpen, setMoreOpen] = useState(false);

	const moreActive =
		friendsOnly || (showListings && listingMode !== 'all');

	const toggleLayer = useCallback(
		(id: EntityKind) => {
			if (layers.includes(id)) {
				if (layers.length <= 1) return;
				onLayersChange(layers.filter((k) => k !== id));
			} else {
				onLayersChange([...layers, id]);
			}
		},
		[layers, onLayersChange],
	);

	return (
		<>
			<View style={[styles.wrap, { top }]} pointerEvents="box-none">
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.row}
					keyboardShouldPersistTaps="handled"
				>
					{LAYER_OPTIONS.map((opt) => {
						const active = layers.includes(opt.id);
						return (
							<Pressable
								key={opt.id}
								onPress={() => toggleLayer(opt.id)}
								style={[styles.chip, active && styles.chipActiveLayer]}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
								accessibilityLabel={opt.a11y}
							>
								<Text
									style={[styles.chipText, active && styles.chipTextActive]}
									numberOfLines={1}
								>
									{opt.label}
								</Text>
							</Pressable>
						);
					})}

					<View style={styles.searchBar}>
						<Icon
							name="magnify"
							size={18}
							color={colors.textMuted}
							style={styles.searchIcon}
						/>
						<TextInput
							value={value}
							onChangeText={onChangeText}
							placeholder={placeholder}
							placeholderTextColor={colors.textMuted}
							style={styles.input}
							returnKeyType="search"
							autoCorrect={false}
							autoCapitalize="none"
							clearButtonMode="never"
							accessibilityLabel="Search this area"
						/>
						{value.length > 0 ? (
							<Pressable
								onPress={() => onChangeText('')}
								hitSlop={8}
								accessibilityRole="button"
								accessibilityLabel="Clear search"
							>
								<Icon name="close-circle" size={16} color={colors.textMuted} />
							</Pressable>
						) : null}
					</View>

					<Pressable
						onPress={() => onRankByChange(nextRank(rankBy))}
						style={[styles.chip, rankActive && styles.chipActiveRank]}
						accessibilityRole="button"
						accessibilityLabel={`Sort by ${rankLabel(rankBy)}. Tap to change.`}
					>
						<Text
							style={[styles.chipText, rankActive && styles.chipTextRankActive]}
							numberOfLines={1}
						>
							{rankLabel(rankBy)}
						</Text>
					</Pressable>

					<Pressable
						onPress={onPressCreate}
						style={[styles.chip, styles.chipCreate]}
						accessibilityRole="button"
						accessibilityLabel="Create nearby — sell, wanted, event, or alert"
					>
						<Icon name="plus" size={18} color={colors.onPrimary} />
					</Pressable>

					<Pressable
						onPress={() => setMoreOpen(true)}
						style={[styles.chip, moreActive && styles.chipActiveMore]}
						accessibilityRole="button"
						accessibilityLabel="More map filters"
					>
						<Icon
							name="tune-variant"
							size={16}
							color={moreActive ? colors.onPrimary : colors.textSecondary}
						/>
						<Text
							style={[styles.chipText, moreActive && styles.chipTextActive]}
							numberOfLines={1}
						>
							More
						</Text>
					</Pressable>
				</ScrollView>
			</View>

			<Modal
				visible={moreOpen}
				transparent
				animationType="fade"
				onRequestClose={() => setMoreOpen(false)}
			>
				<Pressable style={styles.modalBackdrop} onPress={() => setMoreOpen(false)}>
					<Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
						<Text style={styles.modalTitle}>Filters</Text>

						{showPeople ? (
							<>
								<Text style={styles.modalSection}>People</Text>
								<Pressable
									onPress={() => onFriendsOnlyChange(!friendsOnly)}
									style={[styles.modalRow, friendsOnly && styles.modalRowActive]}
									accessibilityRole="button"
									accessibilityState={{ selected: friendsOnly }}
								>
									<Text
										style={[
											styles.modalRowText,
											friendsOnly && styles.modalRowTextActive,
										]}
									>
										Friends only
									</Text>
									{friendsOnly ? (
										<Icon name="check" size={18} color={colors.entityFriend} />
									) : null}
								</Pressable>
							</>
						) : null}

						{showListings ? (
							<>
								<Text style={styles.modalSection}>Listings</Text>
								{LISTING_OPTIONS.map((opt) => {
									const active = listingMode === opt.id;
									return (
										<Pressable
											key={opt.id}
											onPress={() => onListingModeChange(opt.id)}
											style={[styles.modalRow, active && styles.modalRowActiveListing]}
											accessibilityRole="button"
											accessibilityState={{ selected: active }}
										>
											<Text
												style={[
													styles.modalRowText,
													active && styles.modalRowTextActive,
												]}
											>
												{opt.label}
											</Text>
											{active ? (
												<Icon name="check" size={18} color={colors.entityListing} />
											) : null}
										</Pressable>
									);
								})}
							</>
						) : null}

						{!showPeople && !showListings ? (
							<Text style={styles.modalEmpty}>
								Turn on People or Listings to see extra filters.
							</Text>
						) : null}

						<Pressable
							style={styles.modalDone}
							onPress={() => setMoreOpen(false)}
							accessibilityRole="button"
							accessibilityLabel="Done"
						>
							<Text style={styles.modalDoneText}>Done</Text>
						</Pressable>
					</Pressable>
				</Pressable>
			</Modal>
		</>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: spacing.md,
		right: spacing.md,
		height: COMBINED_FILTER_ROW_HEIGHT,
		zIndex: 20,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingRight: 4,
		minHeight: COMBINED_FILTER_ROW_HEIGHT,
	},
	searchBar: {
		flexDirection: 'row',
		alignItems: 'center',
		minWidth: 120,
		maxWidth: 160,
		height: 36,
		paddingHorizontal: 10,
		borderRadius: radius.pill,
		backgroundColor: 'rgba(18,18,31,0.92)',
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	searchIcon: { marginRight: 4 },
	input: {
		flex: 1,
		padding: 0,
		margin: 0,
		color: colors.textPrimary,
		fontSize: fontSize.sm,
		minWidth: 56,
	},
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: radius.pill,
		backgroundColor: 'rgba(18,18,31,0.92)',
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	chipCreate: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
		paddingHorizontal: 10,
	},
	chipActiveLayer: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	chipActiveRank: {
		backgroundColor: colors.primarySoft,
		borderColor: colors.primaryBorder,
	},
	chipActiveMore: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	chipText: {
		color: colors.textSecondary,
		fontSize: fontSize.xs,
		fontWeight: '700',
	},
	chipTextActive: {
		color: colors.onPrimary,
	},
	chipTextRankActive: {
		color: colors.primary,
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.55)',
		justifyContent: 'flex-end',
		padding: spacing.lg,
	},
	modalCard: {
		backgroundColor: colors.surface,
		borderRadius: radius.lg,
		borderWidth: 1,
		borderColor: colors.borderStrong,
		padding: spacing.lg,
		gap: 8,
	},
	modalTitle: {
		color: colors.textPrimary,
		fontSize: fontSize.lg,
		fontWeight: '700',
		marginBottom: 4,
	},
	modalSection: {
		color: colors.textMuted,
		fontSize: fontSize.xs,
		fontWeight: '700',
		textTransform: 'uppercase',
		marginTop: 8,
	},
	modalRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderRadius: radius.md,
		backgroundColor: colors.surfaceRaised,
		borderWidth: 1,
		borderColor: colors.border,
	},
	modalRowActive: {
		borderColor: colors.entityFriend,
		backgroundColor: 'rgba(46,230,197,0.12)',
	},
	modalRowActiveListing: {
		borderColor: colors.entityListing,
		backgroundColor: 'rgba(76,175,80,0.12)',
	},
	modalRowText: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		fontWeight: '600',
	},
	modalRowTextActive: {
		color: colors.textPrimary,
	},
	modalEmpty: {
		color: colors.textMuted,
		fontSize: fontSize.sm,
		paddingVertical: 8,
	},
	modalDone: {
		marginTop: 12,
		alignItems: 'center',
		paddingVertical: 12,
		borderRadius: radius.pill,
		backgroundColor: colors.primary,
	},
	modalDoneText: {
		color: colors.onPrimary,
		fontSize: fontSize.sm,
		fontWeight: '700',
	},
});
