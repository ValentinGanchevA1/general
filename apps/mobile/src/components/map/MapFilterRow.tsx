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
	datingOnly: boolean;
	onDatingOnlyChange: (next: boolean) => void;
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
	datingOnly,
	onDatingOnlyChange,
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
		friendsOnly || datingOnly || (showListings && listingMode !== 'all');

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
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.row}
				keyboardShouldPersistTaps="handled"
			>
				<View style={styles.searchBox}>
					<Icon name="magnify" size={18} color={colors.textMuted} />
					<TextInput
						value={value}
						onChangeText={onChangeText}
						placeholder={placeholder}
						placeholderTextColor={colors.textFaint}
						style={styles.searchInput}
						returnKeyType="search"
						autoCorrect={false}
						autoCapitalize="none"
						clearButtonMode="while-editing"
					/>
				</View>

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
							<Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
						</Pressable>
					);
				})}

				<Pressable
					onPress={() => onRankByChange(nextRank(rankBy))}
					style={[styles.chip, rankActive && styles.chipActiveRank]}
					accessibilityRole="button"
					accessibilityLabel={`Sort ${rankLabel(rankBy)}`}
				>
					<Text style={[styles.chipText, rankActive && styles.chipTextActive]}>{rankLabel(rankBy)}</Text>
				</Pressable>

				<Pressable
					onPress={onPressCreate}
					style={styles.chipCreate}
					accessibilityRole="button"
					accessibilityLabel="Create nearby"
				>
					<Icon name="plus" size={18} color={colors.onPrimary} />
				</Pressable>

				<Pressable
					onPress={() => setMoreOpen(true)}
					style={[styles.chip, moreActive && styles.chipActiveMore]}
					accessibilityRole="button"
					accessibilityLabel="More map filters"
				>
					<Icon name="tune-variant" size={16} color={moreActive ? colors.primary : colors.textMuted} />
					<Text style={[styles.chipText, moreActive && styles.chipTextActive]}>More</Text>
				</Pressable>
			</ScrollView>

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
									onPress={() => {
										onFriendsOnlyChange(!friendsOnly);
										if (!friendsOnly) onDatingOnlyChange(false);
									}}
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
								<Pressable
									onPress={() => {
										onDatingOnlyChange(!datingOnly);
										if (!datingOnly) onFriendsOnlyChange(false);
									}}
									style={[styles.modalRow, datingOnly && styles.modalRowActive]}
									accessibilityRole="button"
									accessibilityState={{ selected: datingOnly }}
									accessibilityLabel="Dating only"
								>
									<Text
										style={[
											styles.modalRowText,
											datingOnly && styles.modalRowTextActive,
										]}
									>
										Dating
									</Text>
									{datingOnly ? (
										<Icon name="check" size={18} color={colors.primary} />
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
												<Icon name="check" size={18} color={colors.primary} />
											) : null}
										</Pressable>
									);
								})}
							</>
						) : null}
						{!showPeople && !showListings ? (
							<Text style={styles.modalEmpty}>
								Turn on People or Listings for more filters.
							</Text>
						) : null}
						<Pressable
							style={styles.modalDone}
							onPress={() => setMoreOpen(false)}
							accessibilityRole="button"
						>
							<Text style={styles.modalDoneText}>Done</Text>
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
		left: 0,
		right: 0,
		zIndex: 20,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingHorizontal: spacing.md,
		gap: 8,
		minHeight: COMBINED_FILTER_ROW_HEIGHT,
	},
	searchBox: {
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		paddingHorizontal: 10,
		gap: 6,
		minWidth: 140,
		maxWidth: 200,
		height: 36,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
	},
	searchInput: {
		flex: 1,
		color: colors.textPrimary,
		fontSize: fontSize.sm,
		paddingVertical: 0,
	},
	chip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		paddingHorizontal: 12,
		height: 36,
		borderRadius: radius.full,
		backgroundColor: colors.surface,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
	},
	chipActiveLayer: {
		borderColor: colors.primary,
		backgroundColor: colors.primarySoft,
	},
	chipActiveRank: {
		borderColor: colors.primary,
	},
	chipActiveMore: {
		borderColor: colors.primary,
	},
	chipCreate: {
		alignItems: 'center',
		justifyContent: 'center',
		width: 36,
		height: 36,
		borderRadius: radius.full,
		backgroundColor: colors.primary,
	},
	chipText: {
		color: colors.textMuted,
		fontSize: fontSize.sm,
		fontWeight: '600',
	},
	chipTextActive: {
		color: colors.primary,
	},
	modalBackdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.55)',
		justifyContent: 'flex-end',
	},
	modalCard: {
		backgroundColor: colors.surface,
		borderTopLeftRadius: radius.lg,
		borderTopRightRadius: radius.lg,
		padding: spacing.lg,
		paddingBottom: spacing.xl,
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
		letterSpacing: 0.6,
		marginTop: 8,
	},
	modalRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 12,
		paddingHorizontal: 12,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surfaceAlt,
	},
	modalRowActive: {
		borderColor: colors.entityFriend,
	},
	modalRowActiveListing: {
		borderColor: colors.primary,
	},
	modalRowText: {
		color: colors.textPrimary,
		fontSize: fontSize.md,
		fontWeight: '600',
	},
	modalRowTextActive: {
		color: colors.primary,
	},
	modalEmpty: {
		color: colors.textMuted,
		fontSize: fontSize.sm,
		marginTop: 8,
	},
	modalDone: {
		marginTop: 12,
		alignItems: 'center',
		paddingVertical: 14,
		borderRadius: radius.md,
		backgroundColor: colors.primary,
	},
	modalDoneText: {
		color: colors.onPrimary,
		fontSize: fontSize.md,
		fontWeight: '700',
	},
});
