// Compact "Trending nearby" card from viewport points (client-only, Option 1).

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fontSize, radius, spacing } from '@/theme';

import {
	type TrendingItem,
	formatDistanceM,
} from './buildTrending';

const KIND_DOT: Record<TrendingItem['kind'], string> = {
	user: colors.entityUser,
	event: colors.entityEvent,
	listing: colors.entityListing,
};

export interface TrendingCardProps {
	items: TrendingItem[];
	onPressItem: (item: TrendingItem) => void;
	/** Absolute top from safe-area stack. */
	top: number;
	visible: boolean;
}

export function TrendingCard({
	items,
	onPressItem,
	top,
	visible,
}: TrendingCardProps): React.JSX.Element | null {
	if (!visible || items.length === 0) return null;

	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<View style={styles.card}>
				<Text style={styles.heading}>Trending nearby</Text>
				{items.map((item, index) => (
					<Pressable
						key={`${item.kind}:${item.id}`}
						onPress={() => onPressItem(item)}
						style={[styles.row, index > 0 && styles.rowBorder]}
						accessibilityRole="button"
						accessibilityLabel={`${item.title}, ${formatDistanceM(item.distanceM) || 'nearby'}`}
					>
						<View
							style={[styles.dot, { backgroundColor: KIND_DOT[item.kind] }]}
						/>
						<Text style={styles.title} numberOfLines={1}>
							{item.title}
						</Text>
						{item.distanceM != null ? (
							<Text style={styles.distance}>
								{formatDistanceM(item.distanceM)}
							</Text>
						) : null}
					</Pressable>
				))}
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: spacing.lg,
		right: spacing.lg,
		zIndex: 17,
	},
	card: {
		backgroundColor: 'rgba(18,18,31,0.94)',
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: radius.md,
		paddingVertical: 10,
		paddingHorizontal: 12,
	},
	heading: {
		color: colors.textMuted,
		fontSize: fontSize.xs,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 0.4,
		marginBottom: 6,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		paddingVertical: 8,
		gap: 8,
	},
	rowBorder: {
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.border,
	},
	dot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	title: {
		flex: 1,
		color: colors.textPrimary,
		fontSize: fontSize.sm,
		fontWeight: '600',
	},
	distance: {
		color: colors.textMuted,
		fontSize: fontSize.xs,
		fontWeight: '600',
	},
});
