// apps/mobile/src/features/pulse/components/ActivityCard.tsx
//
// Pulse feed row — matches screenshot: avatar, title, meta, type CTA on right
// (Wave back / Message / View).

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import type { ActivityItem, ActivityType } from '@g88/shared';
import { colors, spacing, useAppTheme } from '@/theme';

const ICON_BY_TYPE: Record<ActivityType, string> = {
	chat: 'message-text-outline',
	wave: 'hand-wave',
	listing: 'tag-outline',
	alert: 'calendar-clock',
	match: 'heart',
};

const ACCENT_BY_TYPE: Record<ActivityType, string> = {
	chat: colors.primary,
	wave: colors.primary,
	listing: colors.action,
	alert: colors.action,
	match: colors.danger,
};

interface Props {
	item: ActivityItem;
	onPress: () => void;
	busy?: boolean;
	onWaveBack?: () => void;
	onMessage?: () => void;
	onView?: () => void;
}

export function ActivityCard({
								 item,
								 onPress,
								 busy,
								 onWaveBack,
								 onMessage,
								 onView,
							 }: Props): React.JSX.Element {
	const { colors: themeColors } = useAppTheme();

	const initials = (item.actorName ?? '?')
		.split(' ')
		.map((w) => w[0] ?? '')
		.join('')
		.slice(0, 2)
		.toUpperCase();

	const distance =
		item.distanceM != null ? formatDistance(item.distanceM) : null;
	const metaParts = [relTime(item.createdAt), distance].filter(Boolean);
	const meta = metaParts.join(' · ');

	const handlers: {
		onWaveBack?: () => void;
		onMessage?: () => void;
		onView?: () => void;
	} = {};
	if (onWaveBack) handlers.onWaveBack = onWaveBack;
	if (onMessage) handlers.onMessage = onMessage;
	if (onView) handlers.onView = onView;
	const cta = resolveCta(item, handlers);

	return (
		<Pressable
			style={({ pressed }) => [S.card, { backgroundColor: themeColors.surfaceAlt }, pressed && S.cardPressed]}
			onPress={onPress}
			testID={`activity-card-${item.id}`}
		>
			<View style={S.row}>
				<View style={[S.avatar, { borderColor: ACCENT_BY_TYPE[item.type] }]}>
					{item.type === 'match' ? (
						<MCI name="heart" size={18} color={colors.danger} />
					) : (
						<Text style={S.avatarText}>{initials}</Text>
					)}
				</View>

				<View style={S.body}>
					<Text
						style={[S.title, item.unread && S.titleUnread]}
						numberOfLines={1}
					>
						{item.title}
					</Text>
					{!!item.preview && (
						<Text style={S.preview} numberOfLines={1}>
							{item.preview}
						</Text>
					)}
					{!!meta && <Text style={S.meta}>{meta}</Text>}
				</View>

				{cta ? (
					<TouchableCta
						label={cta.label}
						variant={cta.variant}
						{...(busy != null ? { busy } : {})}
						onPress={(e) => {
							e?.stopPropagation?.();
							cta.onPress();
						}}
					/>
				) : (
					<MCI
						name={ICON_BY_TYPE[item.type]}
						size={18}
						color={colors.textMuted}
					/>
				)}
			</View>
		</Pressable>
	);
}

function resolveCta(
	item: ActivityItem,
	handlers: {
		onWaveBack?: () => void;
		onMessage?: () => void;
		onView?: () => void;
	},
): { label: string; variant: 'wave' | 'message' | 'view'; onPress: () => void } | null {
	if (item.type === 'wave' && handlers.onWaveBack) {
		return { label: 'Wave back', variant: 'wave', onPress: handlers.onWaveBack };
	}
	if ((item.type === 'match' || item.type === 'chat') && handlers.onMessage) {
		return { label: 'Message', variant: 'message', onPress: handlers.onMessage };
	}
	if ((item.type === 'listing' || item.type === 'alert') && handlers.onView) {
		return { label: 'View', variant: 'view', onPress: handlers.onView };
	}
	return null;
}

function TouchableCta({
						  label,
						  variant,
						  busy,
						  onPress,
					  }: {
	label: string;
	variant: 'wave' | 'message' | 'view';
	busy?: boolean;
	onPress: (e?: { stopPropagation?: () => void }) => void;
}): React.JSX.Element {
	return (
		<Pressable
			style={[
				S.cta,
				variant === 'wave' && S.ctaWave,
				variant === 'message' && S.ctaMessage,
				variant === 'view' && S.ctaView,
			]}
			onPress={onPress}
			disabled={busy}
			hitSlop={8}
		>
			{busy ? (
				<ActivityIndicator size="small" color="#fff" />
			) : (
				<Text
					style={[
						S.ctaText,
						variant === 'wave' && S.ctaTextWave,
						variant === 'message' && S.ctaTextMessage,
						variant === 'view' && S.ctaTextView,
					]}
				>
					{label}
				</Text>
			)}
		</Pressable>
	);
}

function formatDistance(m: number): string {
	if (m < 1000) return `${Math.round(m)} m`;
	return `${(m / 1000).toFixed(1)} km`;
}

function relTime(iso: string): string {
	const ms = Date.now() - new Date(iso).getTime();
	const m = Math.floor(ms / 60000);
	if (m < 1) return 'now';
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h`;
	return `${Math.floor(h / 24)}d`;
}

const S = StyleSheet.create({
	card: {
		backgroundColor: colors.surfaceAlt,
		borderRadius: 16,
		paddingVertical: 14,
		paddingHorizontal: 14,
		marginHorizontal: spacing.xl,
		marginBottom: 10,
	},
	cardPressed: { opacity: 0.85 },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	avatar: {
		width: 40,
		height: 40,
		borderRadius: 20,
		backgroundColor: colors.bg,
		borderWidth: 2,
		alignItems: 'center',
		justifyContent: 'center',
	},
	avatarText: {
		color: colors.primary,
		fontWeight: '700',
		fontSize: 13,
	},
	body: { flex: 1, minWidth: 0 },
	title: {
		color: colors.textPrimary,
		fontSize: 15,
		fontWeight: '600',
	},
	titleUnread: { fontWeight: '700' },
	preview: {
		color: colors.textSecondary,
		fontSize: 13,
		marginTop: 2,
	},
	meta: {
		color: colors.textMuted,
		fontSize: 12,
		marginTop: 4,
	},
	cta: {
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 12,
		minWidth: 72,
		alignItems: 'center',
	},
	ctaWave: {
		backgroundColor: 'transparent',
		borderWidth: 1,
		borderColor: colors.action,
	},
	ctaMessage: {
		backgroundColor: colors.danger,
	},
	ctaView: {
		backgroundColor: colors.surfaceRaised,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	ctaText: { fontSize: 13, fontWeight: '700' },
	ctaTextWave: { color: colors.action },
	ctaTextMessage: { color: '#fff' },
	ctaTextView: { color: colors.primary },
});
