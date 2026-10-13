// apps/mobile/src/components/map/NearbyPeopleRail.tsx
// Concept board: “Nearby People (N)” horizontal avatar rail on map.
// Gates: people layer on · city-scale · !sheetOpen · ≥1 user in viewport.

import React, { useMemo, useState } from 'react';
import {
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { DiscoveryPoint, EntityPoint } from '@g88/shared';
import { colors, radius, spacing } from '@/theme';

/** Avatar row + header + margins — MapScreen can lift FAB if needed. */
export const NEARBY_PEOPLE_RAIL_HEIGHT = 96;

export type NearbyPeopleRailProps = {
	points: readonly DiscoveryPoint[];
	/** City-scale + people layer + no sheet. Caller computes. */
	visible: boolean;
	onPressUser: (point: EntityPoint & { kind: 'user' }) => void;
	/** Max faces in the scroll (default 24). */
	limit?: number;
};

function isUserPoint(p: DiscoveryPoint): p is EntityPoint & { kind: 'user' } {
	return p.kind === 'user';
}

export function NearbyPeopleRail({
									 points,
									 visible,
									 onPressUser,
									 limit = 24,
								 }: NearbyPeopleRailProps): React.JSX.Element | null {
	const [collapsed, setCollapsed] = useState(false);

	const users = useMemo(() => {
		const list = points.filter(isUserPoint);
		return list.slice(0, limit);
	}, [points, limit]);

	if (!visible || users.length === 0) return null;

	const count = users.length;

	return (
		<View style={styles.wrap} pointerEvents="box-none">
			<Pressable
				style={styles.header}
				onPress={() => setCollapsed((c) => !c)}
				accessibilityRole="button"
				accessibilityLabel={
					collapsed
						? `Expand nearby people, ${count}`
						: `Collapse nearby people, ${count}`
				}
			>
				<Text style={styles.headerTitle}>Nearby People ({count})</Text>
				<Icon
					name={collapsed ? 'chevron-up' : 'chevron-down'}
					size={18}
					color={colors.textMuted}
				/>
			</Pressable>

			{!collapsed ? (
				<ScrollView
					horizontal
					showsHorizontalScrollIndicator={false}
					contentContainerStyle={styles.scroll}
				>
					{users.map((u) => {
						const name = u.meta.displayName?.trim() || 'User';
						const initial = (name[0] ?? '?').toUpperCase();
						const online = u.meta.online === true;
						return (
							<Pressable
								key={u.id}
								style={styles.item}
								onPress={() => onPressUser(u)}
								accessibilityRole="button"
								accessibilityLabel={name}
							>
								<View style={styles.avatarWrap}>
									{u.meta.avatarUrl ? (
										<Image
											source={{ uri: u.meta.avatarUrl }}
											style={styles.avatar}
										/>
									) : (
										<View style={[styles.avatar, styles.avatarPlaceholder]}>
											<Text style={styles.initial}>{initial}</Text>
										</View>
									)}
									{online ? <View style={styles.onlineDot} /> : null}
								</View>
								<Text style={styles.name} numberOfLines={1}>
									{name}
								</Text>
							</Pressable>
						);
					})}
				</ScrollView>
			) : null}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: 0,
		right: 0,
		// Above EventsRail (bottom 16 + ~72)
		bottom: 16 + 72 + 8,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		marginHorizontal: spacing.lg,
		marginBottom: 8,
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: radius.md,
		backgroundColor: 'rgba(18,18,31,0.92)',
		borderWidth: 1,
		borderColor: colors.border,
	},
	headerTitle: {
		color: colors.textPrimary,
		fontSize: 13,
		fontWeight: '700',
	},
	scroll: {
		paddingLeft: 12,
		paddingRight: 12 + 56 + 16,
		gap: 10,
		paddingBottom: 4,
	},
	item: {
		width: 64,
		alignItems: 'center',
		gap: 4,
	},
	avatarWrap: {
		position: 'relative',
	},
	avatar: {
		width: 52,
		height: 52,
		borderRadius: 26,
		backgroundColor: colors.surfaceAlt,
		borderWidth: 2,
		borderColor: colors.borderStrong,
	},
	avatarPlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	initial: {
		color: colors.primary,
		fontSize: 18,
		fontWeight: '700',
	},
	onlineDot: {
		position: 'absolute',
		right: 1,
		bottom: 1,
		width: 12,
		height: 12,
		borderRadius: 6,
		backgroundColor: colors.success,
		borderWidth: 2,
		borderColor: colors.bg,
	},
	name: {
		color: colors.textSecondary,
		fontSize: 11,
		fontWeight: '600',
		maxWidth: 64,
		textAlign: 'center',
	},
});
