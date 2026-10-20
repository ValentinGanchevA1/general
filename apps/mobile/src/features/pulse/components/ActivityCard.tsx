// apps/mobile/src/features/pulse/components/ActivityCard.tsx
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ActivityItem, ActivityType } from '@g88/shared';
import { colors, spacing, useAppTheme } from '@/theme';

const ICON_BY_TYPE: Record<ActivityType, string> = {
	chat: 'message-text-outline',
	wave: 'hand-wave',
	listing: 'tag-outline',
	alert: 'alert-circle-outline',
	match: 'heart',
	event: 'calendar-outline',
};

const ACCENT_BY_TYPE: Record<ActivityType, string> = {
	chat: colors.primary,
	wave: colors.primary,
	listing: colors.action,
	alert: colors.danger,
	match: colors.danger,
	event: colors.primary,
};

interface Props {
	item: ActivityItem;
	onPress: () => void;
	onView?: () => void;
}

export function ActivityCard({ item, onPress, onView }: Props): React.JSX.Element {
	const { colors: themeColors } = useAppTheme();
	const initials = (item.actorName ?? '?')
		.split(' ')
		.map((word) => word[0] ?? '')
		.join('')
		.slice(0, 2)
		.toUpperCase();
	const distance = item.distanceM != null ? formatDistance(item.distanceM) : null;
	const meta = [relTime(item.createdAt), distance].filter(Boolean).join(' · ');
	const isDiscoveryItem = item.type === 'listing' || item.type === 'alert' || item.type === 'event';

	return (
		<Pressable
			style={({ pressed }) => [S.card, { backgroundColor: themeColors.surfaceAlt }, pressed && S.cardPressed]}
			onPress={onPress}
			testID={`activity-card-${item.id}`}
		>
			<View style={S.row}>
				<View style={[S.avatar, { borderColor: ACCENT_BY_TYPE[item.type] }]}>
					{isDiscoveryItem ? (
						<MCI name={ICON_BY_TYPE[item.type]} size={19} color={ACCENT_BY_TYPE[item.type]} />
					) : (
						<Text style={S.avatarText}>{initials}</Text>
					)}
				</View>
				<View style={S.body}>
					<Text style={[S.title, item.unread && S.titleUnread]} numberOfLines={1}>{item.title}</Text>
					{!!item.preview && <Text style={S.preview} numberOfLines={2}>{item.preview}</Text>}
					{!!meta && <Text style={S.meta}>{meta}</Text>}
				</View>
				{isDiscoveryItem && onView ? (
					<Pressable
						style={S.cta}
						onPress={(event) => {
							event.stopPropagation();
							onView();
						}}
						hitSlop={8}
					>
						<Text style={S.ctaText}>View</Text>
					</Pressable>
				) : (
					<MCI name={ICON_BY_TYPE[item.type]} size={18} color={colors.textMuted} />
				)}
			</View>
		</Pressable>
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

const S = StyleSheet.create({
	card: { backgroundColor: colors.surfaceAlt, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, marginHorizontal: spacing.xl, marginBottom: 10 },
	cardPressed: { opacity: 0.85 },
	row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
	avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.bg, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
	avatarText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
	body: { flex: 1, minWidth: 0 },
	title: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
	titleUnread: { fontWeight: '700' },
	preview: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
	meta: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
	cta: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, minWidth: 64, alignItems: 'center', backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong },
	ctaText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
});
