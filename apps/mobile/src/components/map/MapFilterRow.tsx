// Map chrome v3: exclusive segments (All · People · Events · Listings) + search + Filters.

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

import type { EntityKind } from '@g88/shared';
import { colors, fontSize, radius, spacing } from '@/theme';

import { COMBINED_FILTER_ROW_HEIGHT } from './mapChromeLayout';

/** Exclusive map layer segment. */
export type MapLayerSegment = 'all' | EntityKind;

export const DEFAULT_MAP_LAYERS: EntityKind[] = ['user', 'event', 'listing'];

const SEGMENTS: Array<{ id: MapLayerSegment; label: string; a11y: string }> = [
	{ id: 'all', label: 'All', a11y: 'Show people, events, and listings' },
	{ id: 'user', label: 'People', a11y: 'People layer only' },
	{ id: 'event', label: 'Events', a11y: 'Events layer only' },
	{ id: 'listing', label: 'Listings', a11y: 'Listings layer only' },
];

export function segmentToKinds(segment: MapLayerSegment): EntityKind[] {
	if (segment === 'all') return [...DEFAULT_MAP_LAYERS];
	return [segment];
}

export interface MapFilterRowProps {
	value: string;
	onChangeText: (text: string) => void;
	segment: MapLayerSegment;
	onSegmentChange: (next: MapLayerSegment) => void;
	/** Opens MapFiltersSheet (Friends / sort / listing mode). */
	onPressFilters: () => void;
	/** Visual hint when non-default filters are active. */
	filtersActive?: boolean;
	top: number;
	placeholder?: string;
}

export function MapFilterRow({
	value,
	onChangeText,
	segment,
	onSegmentChange,
	onPressFilters,
	filtersActive = false,
	top,
	placeholder = 'Search nearby…',
}: MapFilterRowProps): React.JSX.Element {
	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.row}
				keyboardShouldPersistTaps="handled"
			>
				{SEGMENTS.map((opt) => {
					const active = segment === opt.id;
					return (
						<Pressable
							key={opt.id}
							onPress={() => onSegmentChange(opt.id)}
							style={[styles.chip, active && styles.chipActive]}
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
					onPress={onPressFilters}
					style={[styles.chip, styles.filtersChip, filtersActive && styles.chipActive]}
					accessibilityRole="button"
					accessibilityLabel="Map filters"
				>
					<Icon
						name="tune-variant"
						size={16}
						color={filtersActive ? colors.onPrimary : colors.textSecondary}
					/>
					<Text
						style={[styles.chipText, filtersActive && styles.chipTextActive]}
						numberOfLines={1}
					>
						Filters
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
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: radius.pill,
		backgroundColor: 'rgba(18,18,31,0.92)',
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	filtersChip: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	chipActive: {
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
});
