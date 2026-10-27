// apps/mobile/src/features/pulse/components/ActivityCard.tsx
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ActivityItem, ActivityType } from '@g88/shared';
import { spacing, useAppTheme, type ThemeColors } from '@/theme';
import { getActivitySentence } from '../activityNarrative';

const ICON_BY_TYPE: Record<ActivityType, string> = {
	chat: 'message-text-outline',
	wave: 'hand-wave',
	listing: 'tag-outline',
	alert: 'alert-circle-outline',
	match: 'heart',
	event: 'calendar-outline',
};

function getAccentByType(colors: ThemeColors): Record<ActivityType, string> {
	return {
		chat: colors.actionPrimary,
		wave: colors.actionPrimary,
		listing: colors.entityListing,
		alert: colors.danger,
		match: colors.entityPerson,
		event: colors.entityEvent,
	};
}

interface Props {
	item: ActivityItem;
	onPress: () => void;
	onView?: () => void;
}

export function ActivityCard({ item, onPress, onView }: Props): React.JSX.Element {
	const { colors } = useAppTheme();
	const styles = useMemo(() => createStyles(colors), [colors]);
	const accentByType = useMemo(() => getAccentByType(colors), [colors]);
	const initials = (item.actorName ?? '?')
		.split(' ')
		.map((word) => word[0] ?? '')
		.join('')
		.slice(0, 2)
		.toUpperCase();
	const distance = item.distanceM != null ? formatDistance(item.distanceM) : null;
	const meta = [relTime(item.createdAt), distance].filter(Boolean).join(' · ');
	const isDiscoveryItem = item.type === 'listing' || item.type === 'alert' || item.type === 'event';
	const sentence = getActivitySentence(item);
	const accent = accentByType[item.type];

	return (
		<View style={styles.timelineRow}>
			<View style={styles.timelineRail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
				<View style={[styles.timelineDot, { borderColor: accent }]} />
				<View style={styles.timelineLine} />
			</View>
			<Pressable
				style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
				onPress={onPress}
				testID={`activity-card-${item.id}`}
			>
				<View style={styles.row}>
					<View style={[styles.avatar, { borderColor: accent }]}>
						{isDiscoveryItem ? (
							<MCI name={ICON_BY_TYPE[item.type]} size={19} color={accent} />
						) : (
							<Text style={styles.avatarText}>{initials}</Text>
						)}
					</View>
					<View style={styles.body}>
						{sentence ? (
							<Text style={styles.narrative} numberOfLines={2}>
								<Text style={styles.narrativeActor}>{sentence.actor}</Text>
								{' '}{sentence.verb}{' '}
								<Text style={styles.narrativeObject}>{sentence.objectLabel}</Text>
								{sentence.placeLabel ? <Text>{' at '}<Text style={styles.narrativeObject}>{sentence.placeLabel}</Text></Text> : null}
							</Text>
						) : (
							<Text style={[styles.title, item.unread && styles.titleUnread]} numberOfLines={1}>{item.title}</Text>
						)}
						{!!item.preview && <Text style={styles.preview} numberOfLines={2}>{item.preview}</Text>}
						{!!meta && <Text style={styles.meta}>{meta}</Text>}
					</View>
					{isDiscoveryItem && onView ? (
						<Pressable
							style={styles.cta}
							onPress={(event) => {
								event.stopPropagation();
								onView();
							}}
							hitSlop={8}
						>
							<Text style={styles.ctaText}>View</Text>
						</Pressable>
					) : (
						<MCI name={ICON_BY_TYPE[item.type]} size={18} color={colors.textMuted} />
					)}
				</View>
			</Pressable>
		</View>
	);
}

function formatDistance(m: number): string {
	if (m < 1000) return `${Math.round(m)} m`;
	return `${(m / 1000).toFixed(1)} km`;
}

function relTime(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	const minutes = Math.floor(ms / 60000);
	if (minutes < 1) return 'now';
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	return `${Math.floor(hours / 24)}d`;
}

function createStyles(colors: ThemeColors) {
	return StyleSheet.create({
		timelineRow: { flexDirection: 'row', marginHorizontal: spacing.xl, alignItems: 'stretch' },
		timelineRail: { width: 14, alignItems: 'center', marginRight: 8 },
		timelineDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, backgroundColor: colors.bg, marginTop: 20 },
		timelineLine: { width: StyleSheet.hairlineWidth, flex: 1, minHeight: 42, backgroundColor: colors.borderStrong, marginTop: 4 },
		card: { flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10 },
		cardPressed: { opacity: 0.85 },
		row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
		avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
		avatarText: { color: colors.entityPerson, fontWeight: '700', fontSize: 13 },
		body: { flex: 1, minWidth: 0 },
		title: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
		titleUnread: { fontWeight: '700' },
		narrative: { color: colors.textSecondary, fontSize: 15, lineHeight: 20 },
		narrativeActor: { color: colors.textPrimary, fontWeight: '700' },
		narrativeObject: { color: colors.textPrimary, fontWeight: '600' },
		preview: { color: colors.textSecondary, fontSize: 13, marginTop: 3 },
		meta: { color: colors.textMuted, fontSize: 12, marginTop: 5 },
		cta: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, minWidth: 64, alignItems: 'center', backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
		ctaText: { color: colors.actionPrimary, fontSize: 13, fontWeight: '700' },
	});
}
