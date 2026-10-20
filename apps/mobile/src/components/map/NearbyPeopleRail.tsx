// Concept-board “Nearby People” map overlay.
// Uses a compact translucent panel so nearby identity remains readable without
// competing with the map itself.

import React, { useMemo } from 'react';
import {
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { DiscoveryPoint, EntityPoint } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { useUserLocation } from '@/features/location/useUserLocation';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

/** Header + avatar row + panel spacing. */
export const NEARBY_PEOPLE_RAIL_HEIGHT = 124;

export type NearbyPeopleRailProps = {
	points: readonly DiscoveryPoint[];
	/** City-scale + people layer + no sheet. Caller computes. */
	visible: boolean;
	onPressUser: (point: EntityPoint & { kind: 'user' }) => void;
	/** Max faces in the scroll (default 24). */
	limit?: number;
};

type Nav = NativeStackNavigationProp<RootStackParamList>;

function isUserPoint(point: DiscoveryPoint): point is EntityPoint & { kind: 'user' } {
	return point.kind === 'user';
}

function toRadians(value: number): number {
	return (value * Math.PI) / 180;
}

function distanceMeters(
	from: { lat: number; lng: number },
	to: { lat: number; lng: number },
): number {
	const earthRadiusM = 6_371_000;
	const dLat = toRadians(to.lat - from.lat);
	const dLng = toRadians(to.lng - from.lng);
	const lat1 = toRadians(from.lat);
	const lat2 = toRadians(to.lat);
	const sinLat = Math.sin(dLat / 2);
	const sinLng = Math.sin(dLng / 2);
	const a = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
	return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(meters: number | null): string {
	if (meters == null || !Number.isFinite(meters)) return 'Nearby';
	if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
	const km = meters / 1000;
	return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function NearbyPeopleRail({
	points,
	visible,
	onPressUser,
	limit = 24,
}: NearbyPeopleRailProps): React.JSX.Element | null {
	const navigation = useNavigation<Nav>();
	const { colors } = useAppTheme();
	const { coords } = useUserLocation();

	const users = useMemo(
		() => points.filter(isUserPoint).slice(0, limit),
		[points, limit],
	);

	if (!visible || users.length === 0) return null;

	const ringColors = [
		colors.primary,
		colors.info,
		colors.accent,
		colors.entityUser,
		colors.entityFriend,
	] as const;

	return (
		<View
			style={[
				styles.wrap,
				{
					borderColor: colors.borderStrong,
					shadowColor: colors.shadowInk,
				},
			]}
			pointerEvents="box-none"
		>
			<View style={styles.header}>
				<Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Nearby People ({users.length})</Text>
				<Pressable
					onPress={() => navigation.navigate('Main', { screen: 'Pulse', params: { filter: 'nearby' } })}
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel="See all nearby people"
				>
					<Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
				</Pressable>
			</View>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.scroll}
			>
				{users.map((user, index) => {
					const name = user.meta.displayName?.trim() || 'User';
					const initial = (name[0] ?? '?').toUpperCase();
					const distance = coords == null
						? null
						: distanceMeters(coords, { lat: user.lat, lng: user.lng });
					const ringColor = ringColors[index % ringColors.length] ?? colors.primary;

					return (
						<Pressable
							key={user.id}
							style={styles.item}
							onPress={() => onPressUser(user)}
							accessibilityRole="button"
							accessibilityLabel={`${name}, ${formatDistance(distance)}`}
						>
							<View style={[styles.avatarRing, { borderColor: ringColor }]}> 
								{user.meta.avatarUrl ? (
									<Image source={{ uri: user.meta.avatarUrl }} style={styles.avatar} />
								) : (
									<View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
										<Text style={[styles.initial, { color: ringColor }]}>{initial}</Text>
									</View>
								)}
								{user.meta.online === true ? (
									<View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: colors.bg }]} />
								) : null}
							</View>
							<Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
								{name}
							</Text>
							<Text style={[styles.distance, { color: colors.textMuted }]} numberOfLines={1}>
								{formatDistance(distance)}
							</Text>
						</Pressable>
					);
				})}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: 12,
		right: 12,
		bottom: 142,
		paddingTop: 12,
		paddingBottom: 10,
		borderRadius: radius.xl,
		backgroundColor: 'rgba(10,10,15,0.90)',
		borderWidth: 1,
		zIndex: 18,
		shadowOpacity: 0.22,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 },
		elevation: 6,
	},
	header: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingHorizontal: spacing.md,
		marginBottom: 10,
	},
	headerTitle: {
		fontSize: fontSize.md,
		fontWeight: '800',
	},
	seeAll: {
		fontSize: fontSize.sm,
		fontWeight: '700',
	},
	scroll: {
		paddingHorizontal: spacing.sm,
		gap: 10,
	},
	item: {
		width: 64,
		alignItems: 'center',
	},
	avatarRing: {
		width: 54,
		height: 54,
		borderRadius: 27,
		borderWidth: 2,
		padding: 2,
		position: 'relative',
	},
	avatar: {
		width: 46,
		height: 46,
		borderRadius: 23,
	},
	avatarPlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	initial: {
		fontSize: 18,
		fontWeight: '800',
	},
	onlineDot: {
		position: 'absolute',
		right: -1,
		bottom: -1,
		width: 12,
		height: 12,
		borderRadius: 6,
		borderWidth: 2,
	},
	name: {
		maxWidth: 64,
		marginTop: 5,
		fontSize: 11,
		fontWeight: '700',
		textAlign: 'center',
	},
	distance: {
		maxWidth: 64,
		marginTop: 1,
		fontSize: 10,
		fontWeight: '500',
		textAlign: 'center',
	},
});
