// Map chrome: unified chip row — listing mode (All | For sale | Wanted) + Friends toggle.
// Same discovery params as the previous separate filters; visual composition only.

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ListingMode } from '@g88/shared';
import { fontSize, radius, spacing, useAppTheme, type ThemeColors } from '@/theme';

export type ListingModeFilterValue = 'all' | ListingMode;

export interface CategoryFilterBarProps {
	listingMode: ListingModeFilterValue;
	onListingModeChange: (next: ListingModeFilterValue) => void;
	friendsOnly: boolean;
	onFriendsOnlyChange: (next: boolean) => void;
	/** Absolute top from safe-area stack (mapChromeLayout). */
	top: number;
	/** When false, listing chips are hidden (friends-only layer active). */
	showListingMode: boolean;
}

const LISTING_OPTIONS: Array<{ id: ListingModeFilterValue; label: string }> = [
	{ id: 'all', label: 'All' },
	{ id: 'sell', label: 'For sale' },
	{ id: 'buy', label: 'Wanted' },
];

export function CategoryFilterBar({
	listingMode,
	onListingModeChange,
	friendsOnly,
	onFriendsOnlyChange,
	top,
	showListingMode,
}: CategoryFilterBarProps): React.JSX.Element {
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);

	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<View style={styles.row}>
				{showListingMode
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
									<Text
										style={[styles.chipText, active && styles.chipTextActive]}
									>
										{opt.label}
									</Text>
								</Pressable>
							);
					  })
					: null}

				<Pressable
					onPress={() => onFriendsOnlyChange(!friendsOnly)}
					style={[styles.chip, friendsOnly && styles.chipActiveFriends]}
					accessibilityRole="button"
					accessibilityState={{ selected: friendsOnly }}
					accessibilityLabel={
						friendsOnly ? 'Show everyone nearby' : 'Show friends only'
					}
				>
					<Text
						style={[styles.chipText, friendsOnly && styles.chipTextActive]}
					>
						Friends
					</Text>
				</Pressable>
			</View>
		</View>
	);
}

function createStyles(colors: ThemeColors) {
	return StyleSheet.create({
		wrap: {
			position: 'absolute',
			left: spacing.lg,
			right: spacing.lg,
			zIndex: 18,
		},
		row: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			alignItems: 'center',
			gap: 8,
		},
		chip: {
			paddingHorizontal: 12,
			paddingVertical: 8,
			borderRadius: radius.pill,
			backgroundColor: colors.surfacePrimary,
			borderWidth: 1,
			borderColor: colors.borderStrong,
		},
		chipActiveListing: {
			backgroundColor: colors.primary,
			borderColor: colors.primary,
		},
		chipActiveFriends: {
			backgroundColor: colors.entityFriend,
			borderColor: colors.entityFriend,
		},
		chipText: {
			color: colors.textSecondary,
			fontSize: fontSize.xs,
			fontWeight: '700',
		},
		chipTextActive: {
			color: colors.onPrimary,
		},
	});
}
