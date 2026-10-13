// apps/mobile/src/components/Profile/ProfileTrustScoreCard.tsx
// Concept board: Trust Score card + Gold Verified on self Profile.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

import { colors, fontSize, radius, spacing } from '@/theme';
import { formatTrustScoreLabel } from '@/features/profile/formatTrustScore';

export type ProfileTrustScoreCardProps = {
	score: number | null | undefined;
	idVerified: boolean;
	onPress?: () => void;
};

/**
 * Compact board-style trust summary under the self profile hero.
 * Taps through to TrustCenter when onPress provided.
 */
export function ProfileTrustScoreCard({
										  score,
										  idVerified,
										  onPress,
									  }: ProfileTrustScoreCardProps): React.JSX.Element {
	const label = formatTrustScoreLabel(score);
	const numeric =
		typeof score === 'number' && Number.isFinite(score) ? Math.round(score) : null;
	const ringColor =
		numeric == null
			? colors.borderStrong
			: numeric >= 80
				? colors.success
				: numeric >= 50
					? colors.primary
					: colors.warning;

	const body = (
		<View style={styles.card}>
			<View style={[styles.ring, { borderColor: ringColor }]}>
				<Text style={styles.score}>{label}</Text>
			</View>
			<View style={styles.body}>
				<Text style={styles.title}>Trust Score</Text>
				{idVerified ? (
					<View style={styles.goldRow}>
						<Icon name="shield-check" size={14} color={colors.premium} />
						<Text style={styles.gold}>Gold Verified</Text>
					</View>
				) : (
					<Text style={styles.hint}>Complete ID for Gold Verified</Text>
				)}
			</View>
			{onPress != null ? (
				<Icon name="chevron-right" size={20} color={colors.textMuted} />
			) : null}
		</View>
	);

	if (onPress == null) return body;

	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel="Open Trust Center"
			style={({ pressed }) => [pressed && styles.pressed]}
		>
			{body}
		</Pressable>
	);
}

const styles = StyleSheet.create({
	card: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
		marginHorizontal: spacing.xl,
		marginTop: spacing.md,
		marginBottom: spacing.sm,
		padding: spacing.md,
		borderRadius: radius.lg,
		backgroundColor: colors.surfaceRaised,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	pressed: { opacity: 0.9 },
	ring: {
		width: 56,
		height: 56,
		borderRadius: 28,
		borderWidth: 4,
		alignItems: 'center',
		justifyContent: 'center',
	},
	score: {
		color: colors.textPrimary,
		fontSize: 16,
		fontWeight: '800',
	},
	body: { flex: 1, minWidth: 0 },
	title: {
		color: colors.textPrimary,
		fontSize: fontSize.md,
		fontWeight: '700',
	},
	goldRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
		marginTop: 4,
	},
	gold: {
		color: colors.premium,
		fontSize: fontSize.sm,
		fontWeight: '700',
	},
	hint: {
		color: colors.textMuted,
		fontSize: fontSize.sm,
		marginTop: 4,
	},
});
