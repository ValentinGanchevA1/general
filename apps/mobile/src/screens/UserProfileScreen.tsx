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
		showMessage,
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
	const optionsSnap = useMemo(() => ['28%', '36%'], []);
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
			items = [];
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

	const identityLine = formatPublicIdentityParts({
		gender: profile.gender ?? null,
		genderSelfDescribe: profile.genderSelfDescribe ?? null,
		sexualOrientation: profile.sexualOrientation ?? null,
		orientationSelfDescribe: profile.orientationSelfDescribe ?? null,
		nationality: profile.nationality ?? null,
	}).join(' · ') || null;

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
						{identityLine ? <Text style={styles.originLine}>{identityLine}</Text> : null}
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

				{!blocked ? (
					<View style={styles.socialRow}>
						<TouchableOpacity
							style={[styles.outlineBtn, isFollowing && styles.outlineBtnActive]}
							onPress={onFollowToggle}
							disabled={followBusy || friendBusy}
						>
							{followBusy ? (
								<ActivityIndicator size="small" color={colors.primary} />
							) : (
								<Text style={styles.outlineBtnText}>{isFollowing ? 'Following' : 'Follow'}</Text>
							)}
						</TouchableOpacity>
						<TouchableOpacity
							style={[
								styles.outlineBtn,
								(rel?.state === 'friends' || rel?.state === 'request_outgoing') &&
								styles.outlineBtnActive,
								rel?.state === 'request_incoming' && styles.outlineBtnAccent,
							]}
							onPress={onFriendAction}
							disabled={friendBusy || followBusy || rel?.state === 'friends'}
						>
							{friendBusy ? (
								<ActivityIndicator size="small" color={colors.primary} />
							) : (
								<Text style={styles.outlineBtnText}>{friendLabel}</Text>
							)}
						</TouchableOpacity>
					</View>
				) : null}

				{!blocked && profile ? (
					<View style={styles.infoBlocks} onLayout={onSectionLayout('trust')}>
						<View style={styles.trustBlock}>
							<View style={styles.trustHeader}>
								<Text style={styles.sectionLabel}>Trust</Text>
								<Text style={styles.trustScore}>
									{profile.verificationScore != null ? `${profile.verificationScore}%` : '0%'}
								</Text>
							</View>
							<View style={styles.trustBadges}>
								{((): React.ReactNode => {
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
									const earned = order.filter((b) => b.ok);
									if (earned.length === 0) {
										return <Text style={styles.trustEmpty}>No verification yet</Text>;
									}
									return earned.map((b) => (
										<View
											key={b.label}
											style={[styles.trustChip, b.label === 'ID' ? styles.trustChipStrong : undefined]}
										>
											<Text
												style={b.label === 'ID' ? styles.trustChipStrongText : styles.trustChipText}
											>
												{b.label}
											</Text>
										</View>
									));
								})()}
							</View>
						</View>
						{profile.status != null ? (
							<View style={styles.statsBlock} onLayout={onSectionLayout('stats')}>
								<Text style={styles.sectionLabel}>Stats</Text>
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

				<View onLayout={onSectionLayout('photos')}>
					<ProfilePhotosSection photos={photoUrls} isSelf={false} padded={false} />
				</View>

				<ProfileTagsSection goals={profile.goals ?? []} goalsTitle="Goals" padded={false} />
			</ScrollView>

			<View style={styles.footer}>
				{blocked ? (
					<TouchableOpacity style={styles.unblockBtn} onPress={() => void unblock()} disabled={blocking}>
						<Text style={styles.unblockBtnText}>Unblock</Text>
					</TouchableOpacity>
				) : (
					<>
						<TouchableOpacity
							style={[styles.footerBtn, styles.waveBtn, waving && styles.btnDisabled]}
							onPress={() => void sendWave()}
							disabled={waving}
						>
							<Text style={styles.footerBtnTextOnPrimary}>
								{waving ? '…' : '👋 Wave'}
							</Text>
						</TouchableOpacity>
						{showMessage ? (
							<TouchableOpacity
								style={[styles.footerBtn, styles.messageBtn, messaging && styles.btnDisabled]}
								onPress={() => void openMessage()}
								disabled={messaging}
							>
								<Text style={styles.footerBtnTextOnPrimary}>
									{messaging ? '…' : canMessage === 'request' ? 'Request chat' : 'Message'}
								</Text>
							</TouchableOpacity>
						) : null}
						<TouchableOpacity
							style={[styles.footerBtn, styles.giftBtn]}
							onPress={() => setGiftSheetOpen(true)}
							accessibilityLabel="Send gift"
						>
							<Text style={styles.giftBtnText}>🎁</Text>
						</TouchableOpacity>
						<TouchableOpacity
							style={[styles.footerBtn, styles.menuBtn]}
							onPress={openMenu}
							accessibilityLabel="More options"
						>
							<Icon name="dots-horizontal" size={22} color={colors.textPrimary} />
						</TouchableOpacity>
					</>
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
	centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
	scroll: { paddingBottom: 24 },
	heroBlock: { marginBottom: 16 },
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
	placeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 },
	onlineLabel: { color: colors.success, fontWeight: '600', fontSize: 13 },
	distanceLabel: { color: colors.textMuted, fontSize: 13 },
	offlineLabel: { color: colors.textMuted, fontSize: 13 },
	placeDot: { color: colors.textFaint, fontSize: 13 },
	viewOnMap: { color: colors.primary, fontWeight: '600', fontSize: 13 },
	mutualLine: { color: colors.primary, fontSize: 13, fontWeight: '600', marginTop: 4 },
	socialRow: {
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: spacing.xl,
		marginBottom: 16,
	},
	outlineBtn: {
		flex: 1,
		borderRadius: radius.md,
		paddingVertical: 11,
		alignItems: 'center',
		justifyContent: 'center',
		minHeight: 42,
		backgroundColor: colors.surfaceAlt,
		borderWidth: 1,
		borderColor: colors.borderStrong,
	},
	outlineBtnActive: {
		borderColor: colors.primary,
	},
	outlineBtnAccent: {
		borderColor: colors.primary,
		backgroundColor: colors.primarySoft,
	},
	outlineBtnText: { color: colors.primary, fontWeight: '700', fontSize: fontSize.md },
	section: { paddingHorizontal: spacing.xl, gap: 10 },
	footer: {
		flexDirection: 'row',
		gap: 10,
		paddingHorizontal: spacing.xl,
		paddingTop: 12,
		paddingBottom: 36,
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
		backgroundColor: colors.primary,
	},
	giftBtn: {
		width: 56,
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
	footerBtnTextOnPrimary: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
	giftBtnText: { fontSize: 20 },
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
		gap: 14,
		marginBottom: 16,
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
