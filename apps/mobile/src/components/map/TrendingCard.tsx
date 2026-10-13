// Compact "Trending nearby" card from viewport points (client-only).
// Collapsed: title + activity counters (screenshot contract).
// Expanded: ranked entity rows.

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, fontSize, spacing } from '@/theme';

import {
	type TrendingItem,
	formatDistanceM,
} from './buildTrending';

const KIND_DOT: Record<TrendingItem['kind'], string> = {
	user: colors.entityUser,
	event: colors.entityEvent,
	listing: colors.entityListing,
};

export interface TrendingSummary {
	/** People (users) in viewport. */
	people: number;
	events: number;
	listings: number;
}

export interface TrendingCardProps {
	items: TrendingItem[];
	onPressItem: (item: TrendingItem) => void;
	/** Absolute top from safe-area stack (mapChromeLayout.mapTrendingTop). */
	top: number;
	visible: boolean;
	/** When true, only the header + counters are shown. */
	collapsed?: boolean;
	onToggleCollapse?: () => void;
	/** Viewport activity counts shown before expand. */
	summary?: TrendingSummary;
}

function formatSummary(summary: TrendingSummary | undefined): string | null {
	if (!summary) return null;
	const { people, events, listings } = summary;
	const total = people + events + listings;
	if (total <= 0) return null;
	const parts: string[] = [];
	if (people > 0) parts.push(`${people} active`);
	if (events > 0) parts.push(`${events} event${events === 1 ? '' : 's'}`);
	if (listings > 0) parts.push(`${listings} listing${listings === 1 ? '' : 's'}`);
	return parts.length > 0 ? parts.join(' · ') : null;
}

export function TrendingCard({
	items,
	onPressItem,
	top,
	visible,
	collapsed = true,
	onToggleCollapse,
	summary,
}: TrendingCardProps): React.JSX.Element | null {
	const summaryLine = useMemo(() => formatSummary(summary), [summary]);
	const hasBody = items.length > 0;
	if (!visible) return null;
	if (!hasBody && summaryLine == null) return null;

	const canToggle = typeof onToggleCollapse === 'function' && hasBody;

	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<View style={styles.card}>
				<Pressable
					onPress={canToggle ? onToggleCollapse : undefined}
					style={styles.headerBlock}
					accessibilityRole={canToggle ? 'button' : undefined}
					accessibilityLabel={
						canToggle
							? collapsed
								? `Expand trending nearby. ${summaryLine ?? ''}`
								: 'Collapse trending nearby'
							: `Trending nearby. ${summaryLine ?? ''}`
					}
					accessibilityState={canToggle ? { expanded: !collapsed } : undefined}
					hitSlop={6}
				>
					<View style={styles.headerTextCol}>
						<Text style={styles.heading}>Trending nearby</Text>
						{summaryLine ? (
							<Text style={styles.summary} numberOfLines={1}>
								{summaryLine}
							</Text>
						) : null}
					</View>
					{canToggle ? (
						<Icon
							name={collapsed ? 'chevron-down' : 'chevron-up'}
							size={20}
							color={colors.textMuted}
						/>
					) : null}
				</Pressable>

				{!collapsed && hasBody
					? items.map((item, index) => (
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
						))
					: null}
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
		backgroundColor: 'rgba(15, 20, 36, 0.94)',
		borderWidth: 1,
		borderColor: colors.borderStrong,
		borderRadius: 16,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	headerBlock: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		gap: 10,
		minHeight: 36,
	},
	headerTextCol: {
		flex: 1,
		minWidth: 0,
		gap: 2,
	},
	heading: {
		color: colors.primary,
		fontSize: 15,
		fontWeight: '700',
	},
	summary: {
		color: colors.textMuted,
		fontSize: 13,
		fontWeight: '500',
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
