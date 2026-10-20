// Concept-board “Events Near You” map overlay.
// The right side intentionally stays clear for MapScreen's GPS recenter control.

import React from 'react';
import {
	Image,
	Pressable,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import type { EventSummary, LatLng } from '@g88/shared';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { openRootScreen } from '@/navigation/openRootScreen';
import { useNearbyEvents } from './useEvents';
import { formatEventDayShort } from './eventFormat';
import { fontSize, radius, spacing, useAppTheme } from '@/theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

/** Panel including section header + event card. */
export const EVENTS_RAIL_HEIGHT = 126;

function toRadians(value: number): number {
	return (value * Math.PI) / 180;
}

function distanceMeters(from: LatLng, to: LatLng): number {
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

function formatDistance(meters: number): string {
	if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
	const km = meters / 1000;
	return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function EventsRail({ location }: { location: LatLng | null }): React.JSX.Element | null {
	const navigation = useNavigation<Nav>();
	const { colors } = useAppTheme();
	const { events } = useNearbyEvents(location);

	if (!location || events.length === 0) return null;

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
				<Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Events Near You</Text>
				<Pressable
					onPress={() => navigation.navigate('Main', { screen: 'Pulse', params: { filter: 'events' } })}
					hitSlop={8}
					accessibilityRole="button"
					accessibilityLabel="See all nearby events"
				>
					<Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
				</Pressable>
			</View>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.scroll}
			>
				{events.map((event) => (
					<EventCard
						key={event.id}
						event={event}
						distanceLabel={formatDistance(distanceMeters(location, event.location))}
						onPress={() => openRootScreen(navigation, 'EventDetail', { eventId: event.id })}
					/>
				))}
			</ScrollView>
		</View>
	);
}

function EventCard({
	event,
	distanceLabel,
	onPress,
}: {
	event: EventSummary;
	distanceLabel: string;
	onPress: () => void;
}): React.JSX.Element {
	const { colors } = useAppTheme();
	const attendeeDots = Math.min(3, Math.max(1, event.attendeeCount));

	return (
		<TouchableOpacity
			style={[styles.card, { borderColor: colors.border }]}
			activeOpacity={0.85}
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={`${event.title}, ${formatEventDayShort(event.startsAt)}, ${distanceLabel}`}
		>
			{event.coverUrl ? (
				<Image source={{ uri: event.coverUrl }} style={styles.cover} />
			) : (
				<View style={[styles.cover, styles.coverPlaceholder, { backgroundColor: colors.surfaceAlt }]}>
					<Icon name="calendar-star" size={22} color={colors.entityEvent} />
				</View>
			)}

			<View style={styles.body}>
				<Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
					{event.title}
				</Text>
				<Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
					{formatEventDayShort(event.startsAt)} · {distanceLabel}
				</Text>
				<View style={styles.attendanceRow}>
					<View style={styles.avatarStack}>
						{Array.from({ length: attendeeDots }, (_, index) => (
							<View
								key={`${event.id}-attendee-${index}`}
								style={[
									styles.attendeeDot,
									{
										backgroundColor: colors.surfaceAlt,
										borderColor: colors.borderStrong,
										marginLeft: index === 0 ? 0 : -6,
									},
								]}
							>
								<Icon name="account" size={11} color={colors.textSecondary} />
							</View>
						))}
					</View>
					<Text style={[styles.going, { color: colors.textSecondary }]}>
						{event.attendeeCount} going
					</Text>
				</View>
			</View>
		</TouchableOpacity>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: 12,
		right: 12,
		bottom: 16,
		paddingTop: 10,
		paddingBottom: 10,
		borderRadius: radius.xl,
		backgroundColor: 'rgba(10,10,15,0.90)',
		borderWidth: 1,
		zIndex: 17,
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
		marginBottom: 8,
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
		paddingLeft: spacing.sm,
		paddingRight: 76,
		gap: 10,
	},
	card: {
		width: 264,
		height: 72,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		padding: 7,
		borderRadius: radius.lg,
		backgroundColor: 'rgba(18,18,31,0.72)',
		borderWidth: 1,
	},
	cover: {
		width: 72,
		height: 58,
		borderRadius: radius.md,
	},
	coverPlaceholder: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	body: {
		flex: 1,
		minWidth: 0,
	},
	title: {
		fontSize: 13,
		fontWeight: '800',
	},
	meta: {
		fontSize: 11,
		marginTop: 3,
	},
	attendanceRow: {
		flexDirection: 'row',
		alignItems: 'center',
		marginTop: 5,
	},
	avatarStack: {
		flexDirection: 'row',
		alignItems: 'center',
		marginRight: 7,
	},
	attendeeDot: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	going: {
		fontSize: 10,
		fontWeight: '600',
	},
});
