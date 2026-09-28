import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ActivityIndicator,
	Image,
	type LayoutChangeEvent,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { appAlert } from '@/ui/appAlert';
import {
	BottomSheetModal,
	BottomSheetView,
} from '@gorhom/bottom-sheet';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '@/navigation/AppNavigator';
import { SendGiftSheet } from '@/features/gifts/SendGiftSheet';
import { VerificationBadge } from '@/components/VerificationBadge';
import { Avatar } from '@/components/Avatar';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';
import { ProfileBio } from '@/components/Profile/ProfileBio';
import { ProfileTagsSection } from '@/components/Profile/ProfileTagsSection';
import { ProfilePhotosSection } from '@/components/Profile/ProfilePhotosSection';
import {
	ActionSheetList,
	sheetChrome,
	useSheetBackdrop,
	type ActionSheetItem,
} from '@/components/sheets';
import { useUserProfileScreenData } from '@/features/profile/useUserProfileScreenData';
import { formatPublicIdentityParts } from '@g88/shared';
import { resolveUserPrimaryCta } from '@/features/social/resolveUserPrimaryCta';
import { colors, spacing, radius, fontSize } from '@/theme';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

type Props = NativeStackScreenProps<RootStackParamList, 'UserProfile'>;

function formatDistanceAway(meters: number): string {
	if (meters < 50) return '~50 m away';
	if (meters < 1000) {
		const rounded = Math.max(100, Math.round(meters / 100) * 100);
		return `~${rounded} m away`;
	}
	const km = meters / 1000;
	if (km < 10) {
		const one = Math.round(km * 10) / 10;
		return `~${one.toFixed(1)} km away`;
	}
	return `~${Math.round(km)} km away`;
}

const COVER_BODY = 160;

/**
 * Visitor profile — P0/P1 CTA hierarchy:
 * Hero → Wave+Message (primary) → Follow/Friend (secondary) → Trust/Stats → content
 * Sticky footer: ⋯ only (Gift + Report + Block + Unfriend). Wave/Message under hero — no duplicate.
 */
export function UserProfileScreen({ route, navigation }: Props): React.JSX.Element {
	const { userId, focus } = route.params;
	const insets = useSafeAreaInsets();
	const {
		profile,
		rel,
		loading,
		waving,
		messaging,
		giftSheetOpen,
		setGiftSheetOpen,
		blocking,
		followBusy,
		friendBusy,
		blocked,
		canMessage,
		photoUrls,
		coverUri,
		isFollowing,
		friendLabel,
		hometown,
		sendWave,
		openMessage,
		viewOnMap,
		unblock,
		confirmBlock,
		onFollowToggle,
		onFriendAction,
		openMutualFriends,
		unfriend,
	} = useUserProfileScreenData(userId, navigation);

	const scrollRef = useRef<ScrollView>(null);
	const sectionY = useRef<
		Partial<Record<'trust' | 'stats' | 'storyline' | 'photos' | 'bio' | 'mutual', number>>
	>({});
	const didFocusScroll = useRef(false);

	const tryScrollToFocus = useCallback(
		(key: 'trust' | 'stats' | 'storyline' | 'photos' | 'bio' | 'mutual', y: number) => {
			if (!focus || focus !== key || didFocusScroll.current) return;
			didFocusScroll.current = true;
			requestAnimationFrame(() => {
				scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
			});
		},
		[focus],
	);

	const onSectionLayout = useCallback(
		(key: 'trust' | 'stats' | 'storyline' | 'photos' | 'bio' | 'mutual') =>
			(e: LayoutChangeEvent) => {
				const y = e.nativeEvent.layout.y;
				sectionY.current[key] = y;
				tryScrollToFocus(key, y);
			},
		[tryScrollToFocus],
	);

	const optionsRef = useRef<BottomSheetModal>(null);
	const optionsSnap = useMemo(() => ['32%', '42%'], []);
	const renderBackdrop = useSheetBackdrop(0.55);
	const [menuItems, setMenuItems] = useState<ActionSheetItem[]>([]);

	useEffect(() => {
		didFocusScroll.current = false;
	}, [userId, focus]);

	useEffect(() => {
		if (!profile || focus !== 'mutual' || didFocusScroll.current) return;
		if (!rel || rel.mutualFriendsCount < 1) return;
		didFocusScroll.current = true;
		navigation.navigate('MutualFriends', {
			peerUserId: userId,
			...(profile.displayName ? { peerName: profile.displayName } : {}),
		});
	}, [profile, focus, rel, navigation, userId]);

	const openMenu = (): void => {
		const name = profile?.displayName ?? 'this user';
		const dismiss = (): void => {
			optionsRef.current?.dismiss();
		};

		let items: ActionSheetItem[];
		if (blocked) {
			items = [
				{
					key: 'unblock',
					label: 'Unblock',
					icon: 'account-check-outline',
					onPress: () => {
						dismiss();
						void unblock();
					},
				},
			];
		} else {
			items = [
				{
					key: 'gift',
					label: 'Send gift',
					icon: 'gift-outline',
					onPress: () => {
						dismiss();
						setGiftSheetOpen(true);
					},
				},
			];
			if (rel?.state === 'friends') {
				items.push({
					key: 'unfriend',
					label: 'Unfriend',
					icon: 'account-remove-outline',
					destructive: true,
					onPress: () => {
						dismiss();
						appAlert('Unfriend', `Remove ${name} from friends?`, [
							{ text: 'Cancel', style: 'cancel' },
							{
								text: 'Unfriend',
								style: 'destructive',
								onPress: () => void unfriend(),
							},
						]);
					},
				});
			}
			items.push({
				key: 'report',
				label: 'Report',
				icon: 'flag-outline',
				onPress: () => {
					dismiss();
					appAlert(
						'Report submitted',
						'Thanks — our team will review this profile. For serious harm use local emergency services.',
					);
				},
			});
			items.push({
				key: 'block',
				label: 'Block user',
				icon: 'block-helper',
				destructive: true,
				onPress: () => {
					dismiss();
					confirmBlock();
				},
			});
		}

		setMenuItems(items);
		optionsRef.current?.present();
	};

	if (loading) {
		return (
			<View style={styles.centered}>
				<ActivityIndicator color={colors.primary} size="large" />
			</View>
		);
	}

	if (!profile) return <View style={styles.centered} />;

	const identityLine =
		formatPublicIdentityParts({
			gender: profile.gender ?? null,
			genderSelfDescribe: profile.genderSelfDescribe ?? null,
			sexualOrientation: profile.sexualOrientation ?? null,
			orientationSelfDescribe: profile.orientationSelfDescribe ?? null,
			nationality: profile.nationality ?? null,
		}).join(' · ') || null;

	const isFriends = rel?.state === 'friends';
	const hasPhotos = photoUrls.length > 0;
	const hasGoals = (profile.goals?.length ?? 0) > 0;
	const hasStats =
		profile.status != null &&
		(profile.status.level != null ||
			profile.status.allTimeRank != null ||
			(profile.status.achievementIcons?.length ?? 0) > 0);

	const trustEarned = ((): Array<{ ok: boolean; label: string }> => {
		const order: Array<{ ok: boolean; label: string }> = [
			{ ok: profile.verification !== 'none', label: 'Email' },
			{
				ok:
					profile.verification === 'phone' ||
					profile.verification === 'selfie' ||
					profile.verification === 'id',
				label: 'Phone',
			},
			{
				ok: profile.verification === 'selfie' || profile.verification === 'id',
				label: 'Photo',
			},
			{ ok: profile.idVerified === true, label: 'ID' },
		];
		return order.filter((b) => b.ok);
	})();

	const primaryCta = resolveUserPrimaryCta({
		relationshipKnown: true,
		blocked,
		canMessage: canMessage ?? 'none',
		matched: profile.relationship?.matched === true,
		waveAvailable: true,
	});

	const primaryCtas =
		primaryCta.kind === 'message' ? (
			<View style={styles.primaryCtaRow}>
				<TouchableOpacity
					style={[styles.primaryCta, styles.messagePrimaryFill, messaging && styles.btnDisabled]}
					onPress={() => void openMessage()}
					disabled={messaging}
					accessibilityRole="button"
					accessibilityLabel="Message"
				>
					{messaging ? (
						<ActivityIndicator size="small" color={colors.onPrimary} />
					) : (
						<Text style={styles.primaryCtaText}>{primaryCta.label}</Text>
					)}
				</TouchableOpacity>
			</View>
		) : primaryCta.kind === 'wave' ? (
			<View style={styles.primaryCtaRow}>
				<TouchableOpacity
					style={[styles.primaryCta, styles.wavePrimary, waving && styles.btnDisabled]}
					onPress={() => void sendWave()}
					disabled={waving}
					accessibilityRole="button"
					accessibilityLabel="Wave"
				>
					{waving ? (
						<ActivityIndicator size="small" color={colors.onPrimary} />
					) : (
						<Text style={styles.primaryCtaText}>👋 {primaryCta.label}</Text>
					)}
				</TouchableOpacity>
			</View>
		) : null;

	const socialSecondary = !blocked ? (
		<View style={styles.socialSecondary}>
			<TouchableOpacity
				onPress={onFollowToggle}
				disabled={followBusy || friendBusy}
				hitSlop={8}
				accessibilityRole="button"
			>
				{followBusy ? (
					<ActivityIndicator size="small" color={colors.primary} />
				) : (
					<Text style={[styles.socialLink, isFollowing && styles.socialLinkActive]}>
						{isFollowing ? 'Following' : 'Follow'}
					</Text>
				)}
			</TouchableOpacity>
			<Text style={styles.socialDot}>·</Text>
			{isFriends ? (
				<Text style={styles.socialLinkMuted}>Friends</Text>
			) : (
				<TouchableOpacity
					onPress={onFriendAction}
					disabled={friendBusy || followBusy}
					hitSlop={8}
					accessibilityRole="button"
				>
					{friendBusy ? (
						<ActivityIndicator size="small" color={colors.primary} />
					) : (
						<Text
							style={[
								styles.socialLink,
								(rel?.state === 'request_outgoing' || rel?.state === 'request_incoming') &&
								styles.socialLinkActive,
							]}
						>
							{friendLabel}
						</Text>
					)}
				</TouchableOpacity>
			)}
		</View>
	) : null;

	return (
		<View style={styles.root}>
			<ScrollView
				ref={scrollRef}
				contentContainerStyle={styles.scroll}
				showsVerticalScrollIndicator={false}
			>
				<View style={styles.heroBlock}>
					<View style={[styles.cover, { height: COVER_BODY + insets.top }]}>
						{coverUri ? (
							<Image source={{ uri: coverUri }} style={styles.coverImage} />
						) : (
							<View style={styles.coverPlaceholder} />
						)}
						<View style={styles.coverScrim} />
					</View>
					<View style={styles.avatarWrap}>
						<Avatar uri={profile.avatarUrl} name={profile.displayName} size={96} ring />
					</View>
					<View style={styles.heroMeta}>
						<View style={styles.nameRow}>
							<Text style={styles.displayName} numberOfLines={1}>
								{profile.displayName}
								{profile.age != null ? `, ${profile.age}` : ''}
							</Text>
							<VerificationBadge
								verification={profile.verification}
								idVerified={profile.idVerified}
								size={18}
							/>
						</View>
						{hometown ? <Text style={styles.originLine}>{hometown}</Text> : null}
						{identityLine ? <Text style={styles.identityLine}>{identityLine}</Text> : null}
						<View style={styles.placeRow}>
							{profile.online ? (
								<Text style={styles.onlineLabel}>Online now</Text>
							) : null}
							{profile.distanceMeters != null ? (
								<>
									{profile.online ? <Text style={styles.placeDot}>·</Text> : null}
									<Text style={styles.distanceLabel}>
										{formatDistanceAway(profile.distanceMeters)}
									</Text>
								</>
							) : !profile.online ? (
								<Text style={styles.offlineLabel}>Recently nearby</Text>
							) : null}
							<Text style={styles.placeDot}>·</Text>
							<TouchableOpacity onPress={viewOnMap} hitSlop={8} accessibilityRole="button">
								<Text style={styles.viewOnMap}>View on map</Text>
							</TouchableOpacity>
						</View>
						{rel && rel.mutualFriendsCount > 0 ? (
							<View onLayout={onSectionLayout('mutual')}>
								<TouchableOpacity onPress={openMutualFriends} accessibilityRole="button">
									<Text style={styles.mutualLine}>
										{rel.mutualFriendsCount} mutual friend
										{rel.mutualFriendsCount === 1 ? '' : 's'}
									</Text>
								</TouchableOpacity>
							</View>
						) : null}
					</View>
				</View>

				{primaryCtas}
				{socialSecondary}

				{!blocked && profile ? (
					<View style={styles.infoBlocks} onLayout={onSectionLayout('trust')}>
						<View style={styles.trustBlock}>
							<View style={styles.trustHeader}>
								<Text style={styles.sectionLabel}>Trust</Text>
								<Text style={styles.trustScore}>
									{profile.verificationScore != null ? `${profile.verificationScore}%` : '0%'}
								</Text>
							</View>
							{trustEarned.length === 0 ? (
								<Text style={styles.trustEmpty}>No verification yet</Text>
							) : (
								<View style={styles.trustBadges}>
									{trustEarned.map((b) => (
										<View
											key={b.label}
											style={[
												styles.trustChip,
												b.label === 'ID' ? styles.trustChipStrong : undefined,
											]}
										>
											<Text
												style={
													b.label === 'ID' ? styles.trustChipStrongText : styles.trustChipText
												}
											>
												{b.label}
											</Text>
										</View>
									))}
								</View>
							)}
						</View>
						{hasStats ? (
							<View style={styles.statsBlock} onLayout={onSectionLayout('stats')}>
								<Text style={styles.sectionLabel}>Activity</Text>
								<View style={styles.statsRow}>
									{profile.status?.level != null ? (
										<View style={styles.statPill}>
											<Text style={styles.statPillValue}>Lv {profile.status.level}</Text>
										</View>
									) : null}
									{profile.status?.allTimeRank != null ? (
										<View style={styles.statPill}>
											<Text style={styles.statPillValue}>#{profile.status.allTimeRank}</Text>
										</View>
									) : null}
									{(profile.status?.achievementIcons?.length ?? 0) > 0 ? (
										<View style={styles.achievementIcons}>
											{profile.status!.achievementIcons!.slice(0, 3).map((icon, i) => (
												<Text key={`${icon}-${i}`} style={styles.achievementIcon}>
													{icon}
												</Text>
											))}
										</View>
									) : null}
								</View>
							</View>
						) : null}
					</View>
				) : null}

				{profile.bio ? (
					<View onLayout={onSectionLayout('bio')}>
						<ProfileBio bio={profile.bio} showTitle padded={false} />
					</View>
				) : null}

				<View style={styles.section} onLayout={onSectionLayout('storyline')}>
					<ProfileStoryline userId={userId} />
				</View>

				{hasPhotos ? (
					<View onLayout={onSectionLayout('photos')}>
						<ProfilePhotosSection photos={photoUrls} isSelf={false} padded={false} />
					</View>
				) : (
					<View onLayout={onSectionLayout('photos')} />
				)}

				{hasGoals ? (
					<ProfileTagsSection goals={profile.goals ?? []} goalsTitle="Goals" padded={false} />
				) : null}
			</ScrollView>

			{/* Sticky bar: Unblock when blocked; otherwise overflow only (Wave/Message live under hero). */}
			<View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
				{blocked ? (
					<TouchableOpacity
						style={styles.unblockBtn}
						onPress={() => void unblock()}
						disabled={blocking}
					>
						<Text style={styles.unblockBtnText}>Unblock</Text>
					</TouchableOpacity>
				) : (
					<TouchableOpacity
						style={[styles.footerBtn, styles.menuBtn, styles.footerMenuOnly]}
						onPress={openMenu}
						accessibilityRole="button"
						accessibilityLabel="More options"
					>
						<Icon name="dots-horizontal" size={22} color={colors.textPrimary} />
					</TouchableOpacity>
				)}
			</View>

			<SendGiftSheet
				visible={giftSheetOpen}
				onClose={() => setGiftSheetOpen(false)}
				recipientId={userId}
				recipientName={profile.displayName}
			/>

			<BottomSheetModal
				ref={optionsRef}
				snapPoints={optionsSnap}
				enablePanDownToClose
				backdropComponent={renderBackdrop}
				backgroundStyle={sheetChrome.background}
				handleIndicatorStyle={sheetChrome.handle}
			>
				<BottomSheetView style={styles.sheetBody}>
					<ActionSheetList items={menuItems} />
				</BottomSheetView>
			</BottomSheetModal>
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	centered: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		backgroundColor: colors.bg,
	},
	scroll: { paddingBottom: 16 },
	heroBlock: { marginBottom: 12 },
	cover: { width: '100%', backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
	coverImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
	coverPlaceholder: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surfaceRaised },
	coverScrim: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: 'rgba(0,0,0,0.35)',
	},
	avatarWrap: {
		marginTop: -48,
		alignItems: 'center',
	},
	heroMeta: {
		alignItems: 'center',
		paddingHorizontal: spacing.xl,
		marginTop: 10,
		gap: 4,
	},
	nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
	displayName: { color: colors.textPrimary, fontSize: fontSize.xl, fontWeight: '700' },
	originLine: { color: colors.textMuted, fontSize: 14 },
	identityLine: { color: colors.textFaint, fontSize: 13 },
	placeRow: {
		flexDirection: 'row',
		alignItems: 'center',
		flexWrap: 'wrap',
		gap: 4,
		marginTop: 2,
	},
	onlineLabel: { color: colors.success, fontWeight: '600', fontSize: 13 },
	distanceLabel: { color: colors.textMuted, fontSize: 13 },
	offlineLabel: { color: colors.textMuted, fontSize: 13 },
	placeDot: { color: colors.textFaint, fontSize: 13 },
	viewOnMap: { color: colors.primary, fontWeight: '600', fontSize: 13 },
	mutualLine: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },

	primaryCtaRow: {
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: spacing.xl,
		marginBottom: 10,
	},
	primaryCta: {
		flex: 1,
		borderRadius: radius.md,
		paddingVertical: 12,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 48,
	},
	wavePrimary: {
		backgroundColor: colors.primary,
	},
	messagePrimary: {
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.primaryBorder,
	},
	messagePrimaryFill: {
		backgroundColor: colors.action,
		borderColor: colors.action,
	},
	primaryCtaText: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
	messagePrimaryText: { color: colors.primary, fontWeight: '700', fontSize: 15 },

	socialSecondary: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 8,
		paddingHorizontal: spacing.xl,
		marginBottom: 16,
		minHeight: 28,
	},
	socialLink: { color: colors.primary, fontWeight: '600', fontSize: 14 },
	socialLinkActive: { color: colors.textSecondary },
	socialLinkMuted: { color: colors.textMuted, fontWeight: '600', fontSize: 14 },
	socialDot: { color: colors.textFaint, fontSize: 14 },

	section: { paddingHorizontal: spacing.xl, gap: 10 },
	footer: {
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: spacing.xl,
		paddingTop: 12,
		borderTopWidth: StyleSheet.hairlineWidth,
		borderTopColor: colors.borderStrong,
		backgroundColor: colors.bg,
	},
	footerBtn: {
		borderRadius: 14,
		paddingVertical: 14,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 50,
	},
	waveBtn: {
		flex: 1,
		backgroundColor: colors.primary,
	},
	messageBtn: {
		flex: 1,
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.primaryBorder,
	},
	menuBtn: {
		width: 56,
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	footerMenuOnly: {
		marginLeft: 'auto',
		flex: 0,
	},
	footerBtnTextOnPrimary: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
	messageFooterText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
	btnDisabled: { opacity: 0.55 },
	unblockBtn: {
		flex: 1,
		borderRadius: 14,
		padding: 16,
		alignItems: 'center',
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.dangerBorderSoft,
	},
	unblockBtnText: { color: colors.dangerMuted, fontWeight: '700', fontSize: 16 },
	infoBlocks: {
		paddingHorizontal: spacing.xl,
		gap: 12,
		marginBottom: 14,
	},
	trustBlock: { gap: 6 },
	trustHeader: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'space-between',
	},
	sectionLabel: {
		color: colors.textFaint,
		fontSize: 11,
		fontWeight: '700',
		textTransform: 'uppercase',
		letterSpacing: 1,
	},
	trustScore: { color: colors.textMuted, fontSize: 12, fontWeight: '600' },
	trustBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
	trustChip: {
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		paddingHorizontal: 10,
		paddingVertical: 5,
	},
	trustChipText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
	trustChipStrong: { backgroundColor: colors.primary },
	trustChipStrongText: { color: colors.onPrimary, fontSize: 12, fontWeight: '700' },
	trustEmpty: { color: colors.textFaint, fontSize: 12 },
	statsBlock: { gap: 6 },
	statsRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
	statPill: {
		backgroundColor: colors.surface,
		borderRadius: radius.md,
		paddingHorizontal: 10,
		paddingVertical: 5,
	},
	statPillValue: { color: colors.textPrimary, fontSize: 12, fontWeight: '700' },
	achievementIcons: { flexDirection: 'row', gap: 4 },
	achievementIcon: { fontSize: 16 },
	sheetBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
