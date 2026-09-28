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
import { ProfileIdentityLine } from '@/components/Profile/ProfileIdentityLine';
import { ProfileTrustBlock } from '@/components/Profile/ProfileTrustBlock';
import { ProfileStatsRow } from '@/components/Profile/ProfileStatsRow';
import { ProfilePrimaryCtaRow } from '@/components/Profile/ProfilePrimaryCtaRow';
import { ProfileSocialSecondary } from '@/components/Profile/ProfileSocialSecondary';
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

	const hasPhotos = photoUrls.length > 0;
	const hasGoals = (profile.goals?.length ?? 0) > 0;

	const primaryCta = resolveUserPrimaryCta({
		relationshipKnown: true,
		blocked,
		canMessage: canMessage ?? 'none',
		matched: profile.relationship?.matched === true,
		waveAvailable: true,
	});

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
						<ProfileIdentityLine
							mode="other"
							identityLine={identityLine}
							hometownLine={hometown || null}
						/>
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

				<ProfilePrimaryCtaRow
					primaryCta={primaryCta}
					onPress={() => {
						if (primaryCta.kind === 'message') void openMessage();
						else if (primaryCta.kind === 'wave') void sendWave();
					}}
					waving={waving}
					messaging={messaging}
				/>
				<ProfileSocialSecondary
					blocked={blocked}
					isFollowing={isFollowing}
					friendState={rel?.state}
					friendLabel={friendLabel}
					followBusy={followBusy}
					friendBusy={friendBusy}
					onFollowToggle={onFollowToggle}
					onFriendAction={onFriendAction}
				/>

				{!blocked && profile ? (
					<View style={styles.infoBlocks} onLayout={onSectionLayout('trust')}>
						<ProfileTrustBlock
							verification={profile.verification}
							idVerified={profile.idVerified}
							verificationScore={profile.verificationScore}
						/>
						<ProfileStatsRow
							level={profile.status?.level}
							allTimeRank={profile.status?.allTimeRank}
							achievementIcons={profile.status?.achievementIcons}
							onLayout={onSectionLayout('stats')}
						/>
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
	sheetBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl },
});
