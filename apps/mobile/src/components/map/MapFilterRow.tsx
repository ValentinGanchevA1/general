// Map chrome: single row — Search (flex) + listing mode chips + Friends + Sort cycle.
// Replaces separate MapSearchBar + CategoryFilterBar stack for density.

import React from 'react';
import {
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TextInput,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { DiscoveryRankBy, ListingMode } from '@g88/shared';
import { colors, fontSize, radius, spacing } from '@/theme';

import { COMBINED_FILTER_ROW_HEIGHT } from './mapChromeLayout';

export type ListingModeFilterValue = 'all' | ListingMode;

export interface MapFilterRowProps {
	value: string;
	onChangeText: (text: string) => void;
	listingMode: ListingModeFilterValue;
	onListingModeChange: (next: ListingModeFilterValue) => void;
	friendsOnly: boolean;
	onFriendsOnlyChange: (next: boolean) => void;
	rankBy: DiscoveryRankBy;
	onRankByChange: (next: DiscoveryRankBy) => void;
	top: number;
	showListingMode: boolean;
	placeholder?: string;
}

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

export function MapFilterRow({
	value,
	onChangeText,
	listingMode,
	onListingModeChange,
	friendsOnly,
	onFriendsOnlyChange,
	rankBy,
	onRankByChange,
	top,
	showListingMode,
	placeholder = 'Search nearby…',
}: MapFilterRowProps): React.JSX.Element {
	const rankActive = rankBy !== 'relevance';
	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<View style={styles.row}>
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
						<Pressable onPress={() => onChangeText('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search" style={styles.clear}>
							<Icon name="close-circle" size={16} color={colors.textMuted} />
						</Pressable>
					) : null}
				</View>
				<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScroll} style={styles.chipsScrollView} keyboardShouldPersistTaps="handled">
					{showListingMode
						? LISTING_OPTIONS.map((opt) => {
								const active = listingMode === opt.id;
								return (
									<Pressable key={opt.id} onPress={() => onListingModeChange(opt.id)} style={[styles.chip, active && styles.chipActiveListing]} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`Show ${opt.label} listings`}>
										<Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{opt.label}</Text>
									</Pressable>
								);
						  })
						: null}
					<Pressable onPress={() => onFriendsOnlyChange(!friendsOnly)} style={[styles.chip, friendsOnly && styles.chipActiveFriends]} accessibilityRole="button" accessibilityState={{ selected: friendsOnly }} accessibilityLabel={friendsOnly ? 'Show everyone nearby' : 'Show friends only'}>
						<Text style={[styles.chipText, friendsOnly && styles.chipTextActive]} numberOfLines={1}>Friends</Text>
					</Pressable>
					<Pressable onPress={() => onRankByChange(nextRank(rankBy))} style={[styles.chip, rankActive && styles.chipActiveRank]} accessibilityRole="button" accessibilityState={{ selected: rankActive }} accessibilityLabel={`Sort by ${rankLabel(rankBy)}. Tap to change.`}>
						<Text style={[styles.chipText, rankActive && styles.chipTextActive]} numberOfLines={1}>{rankLabel(rankBy)}</Text>
					</Pressable>
				</ScrollView>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, zIndex: 19 },
	row: { height: COMBINED_FILTER_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', gap: 8 },
	searchBar: { flex: 1, minWidth: 0, height: COMBINED_FILTER_ROW_HEIGHT, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(18,18,31,0.94)', borderWidth: 1, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 10 },
	searchIcon: { marginRight: 6 },
	input: { flex: 1, minWidth: 0, color: colors.textPrimary, fontSize: fontSize.sm, paddingVertical: 0, includeFontPadding: false },
	clear: { marginLeft: 4, padding: 2 },
	chipsScrollView: { flexGrow: 0, flexShrink: 0, maxWidth: '58%' },
	chipsScroll: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 2 },
	chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(18,18,31,0.92)', borderWidth: 1, borderColor: colors.borderStrong },
	chipActiveListing: { backgroundColor: colors.primary, borderColor: colors.primary },
	chipActiveFriends: { backgroundColor: colors.entityFriend, borderColor: colors.entityFriend },
	chipActiveRank: { backgroundColor: colors.accent, borderColor: colors.accent },
	chipText: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: '700' },
	chipTextActive: { color: colors.onPrimary },
});
