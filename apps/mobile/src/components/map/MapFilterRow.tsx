// Map chrome: layer chips (Dating · Events · Trading) + search + sort.
// Layers map to discovery kinds (user · event · listing).

import React, { useCallback } from 'react';
import {
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
	{ id: 'user', label: 'Dating', a11y: 'People / dating layer' },
	{ id: 'event', label: 'Events', a11y: 'Events layer' },
	{ id: 'listing', label: 'Trading', a11y: 'Listings / trading layer' },
];

const LISTING_OPTIONS: Array<{ id: ListingModeFilterValue; label: string }> = [
	{ id: 'all', label: 'All' },
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
	top,
	placeholder = 'Search nearby…',
}: MapFilterRowProps): React.JSX.Element {
	const rankActive = rankBy !== 'relevance';
	const showPeople = layers.includes('user');
	const showListings = layers.includes('listing');

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
							<Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
								{opt.label}
							</Text>
						</Pressable>
					);
				})}

				{showListings
					? LISTING_OPTIONS.map((opt) => {
							const active = listingMode === opt.id;
							return (
								<Pressable
									key={opt.id}
									onPress={() => onListingModeChange(opt.id)}
									style={[styles.chip, active && styles.chipActiveListing]}
									accessibilityRole="button"
									accessibilityState={{ selected: active }}
									accessibilityLabel={`Show ${opt.label} listings`}
								>
									<Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
										{opt.label}
									</Text>
								</Pressable>
							);
					  })
					: null}

				{showPeople ? (
					<Pressable
						onPress={() => onFriendsOnlyChange(!friendsOnly)}
						style={[styles.chip, friendsOnly && styles.chipActiveFriends]}
						accessibilityRole="button"
						accessibilityState={{ selected: friendsOnly }}
						accessibilityLabel={friendsOnly ? 'Show everyone nearby' : 'Show friends only'}
					>
						<Text style={[styles.chipText, friendsOnly && styles.chipTextActive]} numberOfLines={1}>
							Friends
						</Text>
					</Pressable>
				) : null}

				<View style={styles.searchBar}>
					<Icon name="magnify" size={18} color={colors.textMuted} style={styles.searchIcon} />
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
						accessibilityLabel="Search nearby people, events, and listings"
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
			</ScrollView>
		</View>
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
		maxWidth: 180,
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
		minWidth: 64,
	},
	chip: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: radius.pill,
		backgroundColor: 'rgba(18,18,31,0.92)',
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	chipActiveLayer: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	chipActiveListing: {
		backgroundColor: colors.entityListing,
		borderColor: colors.entityListing,
	},
	chipActiveFriends: {
		backgroundColor: colors.entityFriend,
		borderColor: colors.entityFriend,
	},
	chipActiveRank: {
		backgroundColor: colors.primarySoft,
		borderColor: colors.primaryBorder,
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
});
