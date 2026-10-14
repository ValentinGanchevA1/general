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
	const ring =
		clamped >= 80 ? colors.success : clamped >= 50 ? colors.primary : colors.warning;
	return (
		<View style={ringStyles.wrap} accessibilityLabel={`Trust score ${clamped}`}>
			<View style={[ringStyles.outer, { borderColor: ring }]}>
				<View style={ringStyles.inner}>
					<Text style={ringStyles.score}>{clamped}</Text>
					<Text style={ringStyles.label}>Trust</Text>
				</View>
			</View>
		</View>
	);
}

const ringStyles = StyleSheet.create({
	wrap: { alignItems: 'center', marginVertical: spacing.md },
	outer: {
		width: 120,
		height: 120,
		borderRadius: 60,
		borderWidth: 6,
		alignItems: 'center',
		justifyContent: 'center',
	},
	inner: {
		...StyleSheet.absoluteFillObject,
		alignItems: 'center',
		justifyContent: 'center',
	},
	score: {
		fontSize: 32,
		fontWeight: '800',
		color: colors.textPrimary,
	},
	label: {
		fontSize: fontSize.sm,
		color: colors.textMuted,
		marginTop: 2,
	},
});

/**
 * Trust Center — progressive verification ladder.
 * Does not embed OTP / ID forms.
 */
export function TrustCenterScreen(): React.JSX.Element {
	const { colors: themeColors } = useAppTheme();
	const navigation = useNavigation<Nav>();
	const route = useRoute<Route>();
	const dispatch = useAppDispatch();
	const profile = useAppSelector((s) => s.profile.data);
	const loading = useAppSelector((s) => s.profile.loading);

	const onRefresh = useCallback(() => {
		void dispatch(fetchProfile());
	}, [dispatch]);

	useFocusEffect(
		useCallback(() => {
			void dispatch(fetchProfile());
		}, [dispatch]),
	);

	const score = profile?.verificationScore ?? 0;
	const next = useMemo(
		() =>
			resolveTrustNextStep({
				emailVerified: Boolean(profile?.emailVerifiedAt),
				phoneVerified: Boolean(profile?.phoneVerifiedAt),
				idVerified:
					profile?.verificationLevel === 'id' || profile?.idVerified === true,
			}),
		[profile],
	);

	const items = useMemo(() => buildVerificationItems(profile), [profile]);

	const openStep = useCallback(
		(id: VerificationItemId) => {
			navigation.navigate('Verification', { focusStep: id });
		},
		[navigation],
	);

	React.useEffect(() => {
		const param = route.params?.focusStep;
		if (param) openStep(param as VerificationItemId);
	}, [route.params?.focusStep, openStep]);

	return (
		<View style={[styles.root, { backgroundColor: themeColors.bg }]}>
			<ScreenHeader title="Trust" />
			<ScrollView
				contentContainerStyle={styles.body}
				refreshControl={
					<RefreshControl
						refreshing={Boolean(loading)}
						onRefresh={onRefresh}
						tintColor={colors.primary}
					/>
				}
			>
				<TrustRing score={score} />
				<Text style={styles.lead}>
					Verify step by step to unlock messaging, stories, and higher trust on the map.
				</Text>

				{profile?.verificationLevel === 'id' || profile?.idVerified ? (
					<View style={styles.goldBanner}>
						<Icon name="shield-check" size={16} color={colors.premium ?? colors.success} />
						<Text style={styles.goldText}>Gold Verified</Text>
					</View>
				) : null}

				{next && next !== 'done' ? (
					<Pressable
						style={styles.nextCta}
						onPress={() => openStep(next as VerificationItemId)}
						accessibilityRole="button"
						accessibilityLabel={`Continue with ${next}`}
					>
						<Text style={styles.nextCtaText}>Continue · {String(next)}</Text>
						<Icon name="chevron-right" size={20} color={colors.onPrimary} />
					</Pressable>
				) : null}

				<Text style={styles.section}>Steps</Text>
				{items.map((item) => (
					<Pressable
						key={item.id}
						style={styles.stepRow}
						onPress={() => openStep(item.id)}
						accessibilityRole="button"
						accessibilityLabel={`${item.title}: ${item.subtitle}`}
					>
						<View style={styles.stepLeft}>
							<Icon
								name={STATUS_ICON[item.status]}
								size={22}
								color={STATUS_COLOR[item.status]}
							/>
							<View style={styles.stepText}>
								<Text style={styles.stepTitle}>{item.title}</Text>
								<Text style={styles.stepSub}>{item.subtitle}</Text>
							</View>
						</View>
						{item.status !== 'success' ? (
							<Icon name="chevron-right" size={18} color={colors.textMuted} />
						) : null}
					</Pressable>
				))}
			</ScrollView>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	body: {
		paddingHorizontal: spacing.lg,
		paddingBottom: spacing.xxl,
	},
	lead: {
		color: colors.textSecondary,
		fontSize: fontSize.md,
		lineHeight: 22,
		marginBottom: spacing.md,
		textAlign: 'center',
	},
	goldBanner: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		marginBottom: spacing.md,
	},
	goldText: {
		color: colors.premium ?? colors.success,
		fontWeight: '700',
		fontSize: fontSize.md,
	},
	nextCta: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 6,
		backgroundColor: colors.primary,
		borderRadius: radius.md,
		paddingVertical: 14,
		marginBottom: spacing.lg,
	},
	nextCtaText: {
		color: colors.onPrimary,
		fontWeight: '700',
		fontSize: fontSize.md,
	},
	section: {
		color: colors.textFaint,
		fontSize: fontSize.xs,
		fontWeight: '700',
		letterSpacing: 0.6,
		marginBottom: spacing.sm,
	},
	stepRow: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
		paddingVertical: 14,
		paddingHorizontal: 12,
		borderRadius: radius.md,
		borderWidth: StyleSheet.hairlineWidth,
		borderColor: colors.borderStrong,
		backgroundColor: colors.surfaceRaised,
		marginBottom: 8,
	},
	stepLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
	stepText: { flex: 1 },
	stepTitle: {
		color: colors.textPrimary,
		fontWeight: '600',
		fontSize: fontSize.md,
	},
	stepSub: {
		color: colors.textSecondary,
		fontSize: fontSize.sm,
		marginTop: 2,
	},
});
