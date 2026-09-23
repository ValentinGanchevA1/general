// Secondary map filters: Friends, sort, listing mode (Trading/Listings).

import React from 'react';
import {
	Modal,
	Pressable,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { DiscoveryRankBy, ListingMode } from '@g88/shared';
import { colors, fontSize, radius, spacing } from '@/theme';

export type ListingModeFilterValue = 'all' | ListingMode;

export interface MapFiltersSheetProps {
	visible: boolean;
	onClose: () => void;
	/** People / All segments — Friends is relevant. */
	showFriends: boolean;
	friendsOnly: boolean;
	onFriendsOnlyChange: (next: boolean) => void;
	/** Listings / All — listing mode relevant. */
	showListingMode: boolean;
	listingMode: ListingModeFilterValue;
	onListingModeChange: (next: ListingModeFilterValue) => void;
	rankBy: DiscoveryRankBy;
	onRankByChange: (next: DiscoveryRankBy) => void;
}

const RANK_OPTIONS: Array<{ id: DiscoveryRankBy; label: string }> = [
	{ id: 'relevance', label: 'Relevant' },
	{ id: 'distance', label: 'Near' },
	{ id: 'newest', label: 'New' },
];

const LISTING_OPTIONS: Array<{ id: ListingModeFilterValue; label: string }> = [
	{ id: 'all', label: 'All listings' },
	{ id: 'sell', label: 'For sale' },
	{ id: 'buy', label: 'Wanted' },
];

export function MapFiltersSheet({
	visible,
	onClose,
	showFriends,
	friendsOnly,
	onFriendsOnlyChange,
	showListingMode,
	listingMode,
	onListingModeChange,
	rankBy,
	onRankByChange,
}: MapFiltersSheetProps): React.JSX.Element {
	const insets = useSafeAreaInsets();

	return (
		<Modal
			visible={visible}
			animationType="slide"
			transparent
			onRequestClose={onClose}
		>
			<Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close filters" />
			<View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
				<View style={styles.handle} />
				<Text style={styles.title}>Map filters</Text>

				<Text style={styles.section}>Sort</Text>
				<View style={styles.row}>
					{RANK_OPTIONS.map((opt) => {
						const active = rankBy === opt.id;
						return (
							<Pressable
								key={opt.id}
								onPress={() => onRankByChange(opt.id)}
								style={[styles.chip, active && styles.chipActive]}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
								accessibilityLabel={`Sort by ${opt.label}`}
							>
								<Text style={[styles.chipText, active && styles.chipTextActive]}>
									{opt.label}
								</Text>
							</Pressable>
						);
					})}
				</View>

				{showFriends ? (
					<>
						<Text style={styles.section}>People</Text>
						<Pressable
							onPress={() => onFriendsOnlyChange(!friendsOnly)}
							style={[styles.chip, friendsOnly && styles.chipActiveFriends]}
							accessibilityRole="button"
							accessibilityState={{ selected: friendsOnly }}
							accessibilityLabel={
								friendsOnly ? 'Show everyone nearby' : 'Show friends only'
							}
						>
							<Text style={[styles.chipText, friendsOnly && styles.chipTextActive]}>
								Friends only
							</Text>
						</Pressable>
					</>
				) : null}

				{showListingMode ? (
					<>
						<Text style={styles.section}>Listings</Text>
						<View style={styles.row}>
							{LISTING_OPTIONS.map((opt) => {
								const active = listingMode === opt.id;
								return (
									<Pressable
										key={opt.id}
										onPress={() => onListingModeChange(opt.id)}
										style={[styles.chip, active && styles.chipActiveListing]}
										accessibilityRole="button"
										accessibilityState={{ selected: active }}
										accessibilityLabel={opt.label}
									>
										<Text style={[styles.chipText, active && styles.chipTextActive]}>
											{opt.label}
										</Text>
									</Pressable>
								);
							})}
						</View>
					</>
				) : null}

				<Pressable
					onPress={onClose}
					style={styles.done}
					accessibilityRole="button"
					accessibilityLabel="Done"
				>
					<Text style={styles.doneText}>Done</Text>
				</Pressable>
			</View>
		</Modal>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		flex: 1,
		backgroundColor: 'rgba(0,0,0,0.45)',
	},
	sheet: {
		backgroundColor: colors.surface,
		borderTopLeftRadius: radius.lg,
		borderTopRightRadius: radius.lg,
		paddingHorizontal: spacing.lg,
		paddingTop: spacing.sm,
		borderTopWidth: 1,
		borderColor: colors.borderStrong,
	},
	handle: {
		alignSelf: 'center',
		width: 40,
		height: 4,
		borderRadius: 2,
		backgroundColor: colors.borderStrong,
		marginBottom: spacing.md,
	},
	title: {
		color: colors.textPrimary,
		fontSize: fontSize.lg,
		fontWeight: '700',
		marginBottom: spacing.md,
	},
	section: {
		color: colors.textSecondary,
		fontSize: fontSize.xs,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.6,
		marginBottom: spacing.sm,
		marginTop: spacing.md,
	},
	row: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	chip: {
		paddingHorizontal: 14,
		paddingVertical: 10,
		borderRadius: radius.pill,
		backgroundColor: colors.bg,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	chipActive: {
		backgroundColor: colors.primary,
		borderColor: colors.primary,
	},
	chipActiveFriends: {
		backgroundColor: colors.entityFriend,
		borderColor: colors.entityFriend,
	},
	chipActiveListing: {
		backgroundColor: colors.entityListing,
		borderColor: colors.entityListing,
	},
	chipText: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		fontWeight: '700',
	},
	chipTextActive: {
		color: colors.onPrimary,
	},
	done: {
		marginTop: spacing.xl,
		alignItems: 'center',
		paddingVertical: 14,
		borderRadius: radius.pill,
		backgroundColor: colors.primary,
	},
	doneText: {
		color: colors.onPrimary,
		fontSize: fontSize.md,
		fontWeight: '700',
	},
});
