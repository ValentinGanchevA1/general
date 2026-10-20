// Compact "Trending nearby" card from viewport points (client-only).
// Collapsed: title + activity counters. Expanded: ranked entity rows.

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { fontSize, useAppTheme, type ThemeColors } from '@/theme';

import {
	MAP_CHROME_GAP,
	MAP_CHROME_H_INSET,
	WEATHER_WIDGET_HEIGHT,
	WEATHER_WIDGET_WIDTH,
} from './mapChromeLayout';
import { type TrendingItem, formatDistanceM } from './buildTrending';

export interface TrendingSummary {
	people: number;
	events: number;
	listings: number;
}

export interface TrendingCardProps {
	items: TrendingItem[];
	onPressItem: (item: TrendingItem) => void;
	top: number;
	visible: boolean;
	collapsed?: boolean;
	onToggleCollapse?: () => void;
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
	return parts.join(' · ');
}

export function TrendingCard({ items, onPressItem, top, visible, collapsed = true, onToggleCollapse, summary }: TrendingCardProps): React.JSX.Element | null {
	const { colors, shadow } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const summaryLine = useMemo(() => formatSummary(summary), [summary]);
	const hasBody = items.length > 0;
	if (!visible || (!hasBody && summaryLine == null)) return null;

	const canToggle = typeof onToggleCollapse === 'function' && hasBody;
	const kindDot = (kind: TrendingItem['kind']): string => {
		if (kind === 'event') return colors.entityEvent;
		if (kind === 'listing') return colors.entityListing;
		return colors.entityUser;
	};

	return (
		<View style={[styles.wrap, { top }]} pointerEvents="box-none">
			<View style={[styles.card, shadow(0.12)]}>
				<Pressable
					onPress={canToggle ? onToggleCollapse : undefined}
					style={({ pressed }) => [styles.headerBlock, pressed && canToggle && styles.pressed]}
					accessibilityRole={canToggle ? 'button' : undefined}
					accessibilityLabel={canToggle ? (collapsed ? `Expand trending nearby. ${summaryLine ?? ''}` : 'Collapse trending nearby') : `Trending nearby. ${summaryLine ?? ''}`}
					accessibilityState={canToggle ? { expanded: !collapsed } : undefined}
					hitSlop={6}
				>
					<View style={styles.headerTextCol}>
						<View style={styles.headingRow}>
							<Icon name="trending-up" size={15} color={colors.discovery} />
							<Text style={styles.heading} numberOfLines={1}>Trending nearby</Text>
						</View>
						{summaryLine ? <Text style={styles.summary} numberOfLines={1}>{summaryLine}</Text> : null}
					</View>
					{canToggle ? <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={colors.textMuted} /> : null}
				</Pressable>

				{!collapsed && hasBody ? items.map((item, index) => (
					<Pressable
						key={`${item.kind}:${item.id}`}
						onPress={() => onPressItem(item)}
						style={({ pressed }) => [styles.row, index > 0 && styles.rowBorder, pressed && styles.pressed]}
						accessibilityRole="button"
						accessibilityLabel={`${item.title}, ${formatDistanceM(item.distanceM) || 'nearby'}`}
					>
						<View style={[styles.dot, { backgroundColor: kindDot(item.kind) }]} />
						<Text style={styles.title} numberOfLines={1}>{item.title}</Text>
						{item.distanceM != null ? <Text style={styles.distance}>{formatDistanceM(item.distanceM)}</Text> : null}
					</Pressable>
				)) : null}
			</View>
		</View>
	);
}

function createStyles(colors: ThemeColors) {
	return StyleSheet.create({
		wrap: { position: 'absolute', left: MAP_CHROME_H_INSET, right: MAP_CHROME_H_INSET + WEATHER_WIDGET_WIDTH + MAP_CHROME_GAP, zIndex: 23 },
		card: { minHeight: WEATHER_WIDGET_HEIGHT, backgroundColor: colors.surfaceRaised, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderSubtle, borderRadius: 16, paddingVertical: 8, paddingHorizontal: 12, justifyContent: 'center' },
		headerBlock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 38 },
		headerTextCol: { flex: 1, minWidth: 0, gap: 2 },
		headingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
		heading: { color: colors.textPrimary, fontSize: 13, fontWeight: '800' },
		summary: { color: colors.textMuted, fontSize: 11, fontWeight: '600' },
		row: { flexDirection: 'row', alignItems: 'center', minHeight: 42, paddingVertical: 7, gap: 8 },
		rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.borderSubtle },
		dot: { width: 8, height: 8, borderRadius: 4 },
		title: { flex: 1, color: colors.textPrimary, fontSize: fontSize.sm, fontWeight: '600' },
		distance: { color: colors.textMuted, fontSize: fontSize.xs, fontWeight: '600' },
		pressed: { opacity: 0.72 },
	});
}
