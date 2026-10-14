// apps/mobile/src/screens/TrustCenterScreen.tsx
// Visual board: circular trust ring + Gold Verified when ID verified.

import React, { useCallback, useMemo } from 'react';
import {
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect, useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import type { AccountStackParamList } from '@/navigation/stacks';
import { useAppDispatch, useAppSelector } from '@/hooks/redux';
import { fetchProfile } from '@/features/profile/profileSlice';
import { resolveTrustNextStep } from '@g88/shared';
import {
	buildVerificationItems,
	type VerificationItemId,
} from '@/components/Profile/VerificationStatusSheet';
import { ScreenHeader } from '@/components/ScreenHeader';
import { colors, fontSize, radius, spacing, useAppTheme } from '@/theme';

type Nav = NativeStackNavigationProp<AccountStackParamList>;
type Route = RouteProp<AccountStackParamList, 'TrustCenter'>;

const STATUS_COLOR = {
	success: colors.success,
	pending: colors.warning,
	error: colors.danger,
	missing: colors.textMuted,
} as const;

const STATUS_ICON = {
	success: 'check-circle',
	pending: 'clock-outline',
	error: 'alert-circle',
	missing: 'circle-outline',
} as const;

function TrustRing({ score }: { score: number }): React.JSX.Element {
	const clamped = Math.max(0, Math.min(100, Math.round(score)));
	const ringColor =
		clamped >= 80 ? colors.success : clamped >= 50 ? colors.primary : colors.warning;

	return (
		<View style={ringStyles.wrap} accessibilityRole="image" accessibilityLabel={`Trust score ${clamped}`}>
			<View style={[ringStyles.outer, { borderColor: ringColor }]}>
				<View style={ringStyles.track} />
				<View style={ringStyles.inner}>
					<Text style={ringStyles.score}>{clamped}</Text>
					<Text style={ringStyles.caption}>Trust</Text>
				</View>
			</View>
		</View>
	);
}

const ringStyles = StyleSheet.create({
	wrap: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	outer: {
		width: 96,
		height: 96,
		borderRadius: 48,
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 7,
	},
	track: {
		...StyleSheet.absoluteFillObject,
		borderRadius: 48,
		borderWidth: 7,
		borderColor: 'rgba(255,255,255,0.08)',
	},
	inner: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	score: {
		color: colors.textPrimary,
		fontSize: 30,
		fontWeight: '800',
		letterSpacing: -0.5,
	},
	caption: {
		color: colors.textMuted,
		fontSize: 11,
		fontWeight: '600',
		marginTop: -2,
	},
});

/**
 * Trust status hub (Option A + visual board ring).
 * Shows ladder + score; routes to existing action screens for the actual flows.
 * Does not embed OTP / ID forms.
 */
export function TrustCenterScreen(): React.JSX.Element {
	const { colors: themeColors } = useAppTheme();
	const navigation = useNavigation<Nav>();
	const route = useRoute<Route>();
	const dispatch = useAppDispatch();
	const profile = useAppSelector((s) => s.profile.profile);
	const loading = useAppSelector((s) => s.profile.loading);

	useFocusEffect(
		useCallback(() => {
			void dispatch(fetchProfile());
		}, [dispatch]),
	);

	const next = useMemo(
		() =>
			resolveTrustNextStep({
				emailVerified: profile?.badges?.email === true,
				phoneVerified: profile?.badges?.phone === true,
				...(profile?.idVerificationStatus != null
					? { idStatus: profile.idVerificationStatus }
					: {}),
			}),
		[profile],
	);

	const items = useMemo(() => buildVerificationItems(profile), [profile]);
	const score = profile?.verificationScore ?? 0;
	const focusStep = route.params?.focusStep;
	const isGold =
		profile?.badges?.id === true ||
		profile?.idVerificationStatus === 'verified' ||
		profile?.verifiedBadge === true;

	const openStep = useCallback(
		(id: VerificationItemId) => {
			if (id === 'email') {
				navigation.navigate('EmailVerification');
				return;
			}
			if (id === 'phone') {
				const phone = profile?.phone;
				if (phone != null && phone !== '') {
					navigation.navigate('Verification', { initialPhone: phone });
				} else {
					navigation.navigate('Verification');
				}
				return;
			}
			navigation.navigate('VerificationId');
		},
		[navigation, profile],
	);

	const onPrimaryCta = useCallback(() => {
		if (next.kind !== 'actionable' || next.step == null) return;
		openStep(next.step);
	}, [next, openStep]);

	return (
		<View style={[styles.root, { backgroundColor: themeColors.bg }]}>
			<ScreenHeader title="Trust" />
			<ScrollView
				contentContainerStyle={styles.body}
				refreshControl={
					<RefreshControl
						refreshing={loading && profile != null}
						onRefresh={() => void dispatch(fetchProfile())}
						tintColor={colors.primary}
					/>
				}
			>
				<View
					style={[
						styles.summary,
						next.kind === 'done' && styles.summaryDone,
						next.kind === 'pending' && styles.summaryPending,
					]}
					accessibilityRole="summary"
				>
					<TrustRing score={score} />
					<View style={styles.summaryBody}>
						<Text style={styles.summaryTitle}>{next.title}</Text>
						<Text style={styles.summaryDetail}>{next.detail}</Text>
						{isGold ? (
							<View style={styles.goldRow}>
								<Icon name="shield-check" size={16} color={colors.premium ?? colors.success} />
								<Text style={styles.goldBadge}>Gold Verified</Text>
							</View>
						) : null}
					</View>
				</View>

				{next.kind === 'actionable' && next.ctaLabel ? (
					<Pressable
						style={styles.primaryCta}
						onPress={onPrimaryCta}
						accessibilityRole="button"
						accessibilityLabel={next.ctaLabel}
					>
						<Text style={styles.primaryCtaText}>{next.ctaLabel}</Text>
						<Icon name="chevron-right" size={20} color={colors.onPrimary} />
					</Pressable>
				) : null}

				<Text style={styles.sectionTitle}>Steps</Text>
				<View style={styles.list}>
					{items.map((item) => {
						const color = STATUS_COLOR[item.status];
						const focused = focusStep === item.id;
						const tappable =
							item.status === 'missing' ||
							item.status === 'error' ||
							(item.id === 'id' && item.status === 'pending');

						return (
							<Pressable
								key={item.id}
								onPress={() => {
									if (item.status === 'success') return;
									if (item.id === 'id' && item.status === 'pending') return;
									openStep(item.id);
								}}
								style={({ pressed }) => [
									styles.row,
									focused && styles.rowFocused,
									pressed && tappable && styles.rowPressed,
								]}
								accessibilityRole="button"
								accessibilityLabel={`${item.title}, ${item.statusLabel}`}
								accessibilityState={{ disabled: item.status === 'success' }}
							>
								<Icon name={STATUS_ICON[item.status]} size={22} color={color} />
								<View style={styles.rowBody}>
									<Text style={styles.rowTitle}>{item.title}</Text>
									<Text style={styles.rowDetail} numberOfLines={2}>
										{item.detail}
									</Text>
								</View>
								<View style={styles.rowTrailing}>
									<Text style={[styles.statusLabel, { color }]}>{item.statusLabel}</Text>
									{item.status !== 'success' && item.status !== 'pending' ? (
										<Icon name="chevron-right" size={18} color={colors.textMuted} />
									) : null}
								</View>
							</Pressable>
						);
					})}
				</View>

				<View style={styles.levelCard}>
					<Text style={styles.levelTitle}>Verification level</Text>
					<Text style={styles.levelBody}>
						{isGold
							? 'Full access to all features and higher visibility in the community.'
							: 'Complete email, phone, and government ID to unlock Gold Verified.'}
					</Text>
				</View>

				<Text style={styles.footnote}>
					Completing steps unlocks stories, higher reach, and stronger identity signals on the map.
				</Text>
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	body: {
		paddingHorizontal: spacing.xl,
		paddingBottom: spacing.xxl,
	},
	summary: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.lg,
		marginTop: spacing.md,
		padding: spacing.lg,
		borderRadius: radius.lg,
		backgroundColor: colors.surfaceRaised,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	summaryDone: {
		borderColor: 'rgba(76, 175, 80, 0.35)',
	},
	summaryPending: {
		borderColor: 'rgba(255, 193, 7, 0.35)',
	},
	summaryBody: { flex: 1, minWidth: 0 },
	summaryTitle: {
		color: colors.textPrimary,
		fontSize: fontSize.lg,
		fontWeight: '700',
	},
	summaryDetail: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		marginTop: 4,
	},
	goldRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
		marginTop: 10,
	},
	goldBadge: {
		color: colors.premium ?? colors.success,
		fontSize: fontSize.sm,
		fontWeight: '700',
	},
	primaryCta: {
		marginTop: spacing.md,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: spacing.xs,
		backgroundColor: colors.primary,
		borderRadius: radius.md,
		paddingVertical: 14,
		paddingHorizontal: spacing.lg,
	},
	primaryCtaText: {
		color: colors.onPrimary,
		fontSize: fontSize.md,
		fontWeight: '700',
	},
	sectionTitle: {
		marginTop: spacing.xl,
		marginBottom: spacing.sm,
		color: colors.textFaint,
		fontSize: 11,
		fontWeight: '600',
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	list: { gap: spacing.xs },
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: spacing.md,
		paddingVertical: spacing.md,
		paddingHorizontal: spacing.sm,
		borderRadius: radius.md,
		backgroundColor: 'rgba(255,255,255,0.04)',
	},
	rowFocused: {
		borderWidth: 1,
		borderColor: colors.primary,
	},
	rowPressed: {
		backgroundColor: 'rgba(255,255,255,0.08)',
	},
	rowBody: { flex: 1, minWidth: 0 },
	rowTitle: {
		color: colors.textPrimary,
		fontSize: fontSize.md,
		fontWeight: '600',
	},
	rowDetail: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		marginTop: 2,
	},
	rowTrailing: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 4,
	},
	statusLabel: {
		fontSize: fontSize.xs,
		fontWeight: '600',
	},
	levelCard: {
		marginTop: spacing.xl,
		padding: spacing.lg,
		borderRadius: radius.lg,
		backgroundColor: colors.surfaceRaised,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	levelTitle: {
		color: colors.textPrimary,
		fontSize: fontSize.md,
		fontWeight: '700',
	},
	levelBody: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		marginTop: 6,
		lineHeight: 20,
	},
	footnote: {
		marginTop: spacing.xl,
		color: colors.textFaint,
		fontSize: fontSize.xs,
		lineHeight: 16,
		textAlign: 'center',
	},
});
