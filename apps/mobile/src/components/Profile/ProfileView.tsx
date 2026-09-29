import React, { useCallback, useEffect, useRef } from 'react';
import {
	Image,
	type LayoutChangeEvent,
	ScrollView,
	StyleSheet,
	Text,
	TouchableOpacity,
	View,
	type ScrollView as ScrollViewType,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/Avatar';
import { VerificationBadge } from '@/components/VerificationBadge';
import { ProfileBio } from '@/components/Profile/ProfileBio';
import { ProfileHeaderPhoto } from '@/components/Profile/ProfileHeaderPhoto';
import { ProfileIdentityLine } from '@/components/Profile/ProfileIdentityLine';
import { ProfilePhotosSection } from '@/components/Profile/ProfilePhotosSection';
import { ProfilePrimaryCtaRow } from '@/components/Profile/ProfilePrimaryCtaRow';
import { ProfileSocialSecondary } from '@/components/Profile/ProfileSocialSecondary';
import { ProfileStatsRow } from '@/components/Profile/ProfileStatsRow';
import { ProfileTagsSection } from '@/components/Profile/ProfileTagsSection';
import { ProfileTrustBlock } from '@/components/Profile/ProfileTrustBlock';
import { ProfileStoryline } from '@/features/stories/components/ProfileStoryline';
import { colors, fontSize, spacing } from '@/theme';

import type { ProfileFocusSection, ProfileViewProps } from './profileView.types';

export type {
	ProfileViewModel,
	ProfileViewActions,
	ProfileViewProps,
	ProfileFocusSection,
	ProfileViewSelfSlots,
} from './profileView.types';

const COVER_BODY = 160;

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

/**
 * Shared profile body. Screens own data hooks, navigation, and sheets.
 * Do not add fetch/side effects here.
 */
export function ProfileView({
								mode,
								profile,
								actions,
								primaryCta,
								waving = false,
								messaging = false,
								followBusy = false,
								friendBusy = false,
								focus,
								activePhotoIndex = 0,
								headerExtra,
								footerExtra,
								selfSlots,
								refreshControl,
							}: ProfileViewProps): React.JSX.Element {
	const insets = useSafeAreaInsets();
	const scrollRef = useRef<ScrollViewType>(null);
	const sectionY = useRef<Partial<Record<ProfileFocusSection, number>>>({});
	const didFocusScroll = useRef(false);

	useEffect(() => {
		didFocusScroll.current = false;
	}, [profile.userId, focus]);

	const tryScrollToFocus = useCallback(
		(key: ProfileFocusSection, y: number) => {
			if (!focus || focus !== key || didFocusScroll.current) return;
			didFocusScroll.current = true;
			requestAnimationFrame(() => {
				scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
			});
		},
		[focus],
	);

	const onSectionLayout = useCallback(
		(key: ProfileFocusSection) => (e: LayoutChangeEvent) => {
			const y = e.nativeEvent.layout.y;
			sectionY.current[key] = y;
			tryScrollToFocus(key, y);
		},
		[tryScrollToFocus],
	);

	// ── mode="self" ───────────────────────────────────────────────────────────
	if (mode === 'self') {
		const mainPhoto = profile.photoUrls[0] ?? profile.avatarUrl ?? null;
		const score = profile.verificationScore ?? 0;

		return (
			<View style={styles.root} testID="profile-view-self">
				<ScrollView
					ref={scrollRef}
					style={styles.scroll}
					contentContainerStyle={styles.content}
					showsVerticalScrollIndicator={false}
					{...(refreshControl != null ? { refreshControl } : {})}
				>
					{headerExtra}

					<ProfileHeaderPhoto
						photoUrl={mainPhoto}
						coverUrl={profile.coverUrl}
						displayName={profile.displayName}
						verificationPercent={score}
						isVisibleOnMap={profile.mapVisible === true}
						isPaid={profile.isPaid}
						{...(profile.tierLabel != null ? { tierLabel: profile.tierLabel } : {})}
						photoCount={profile.photoUrls.length}
						activePhotoIndex={activePhotoIndex}
						{...(actions.onSelectPhotoIndex != null
							? { onSelectPhoto: actions.onSelectPhotoIndex }
							: {})}
						{...(actions.onPressSettings != null
							? { onPressSettings: actions.onPressSettings }
							: {})}
						{...(actions.onBack != null ? { onPressBack: actions.onBack } : {})}
						{...(actions.onPressVerificationBadge != null
							? { onPressVerificationBadge: actions.onPressVerificationBadge }
							: {})}
						{...(actions.onPressPhoto != null ? { onPressPhoto: actions.onPressPhoto } : {})}
						{...(actions.onPressVisibility != null
							? { onPressVisibility: actions.onPressVisibility }
							: {})}
					/>

					<ProfileIdentityLine
						mode="self"
						identityLine={profile.identityLine}
						hometownLine={profile.hometownLine}
						{...(actions.onPressIdentityPreview != null
							? { onPress: actions.onPressIdentityPreview }
							: {})}
					/>

					{profile.bio ? <ProfileBio bio={profile.bio} /> : null}

					<ProfileTagsSection interests={profile.interests} goals={profile.goals} />

					{selfSlots?.trustNext}

					{selfSlots?.activity}

					{selfSlots?.friends}

					{profile.userId ? (
						<View style={styles.section} onLayout={onSectionLayout('storyline')}>
							<ProfileStoryline userId={profile.userId} isSelf />
						</View>
					) : null}

					<View onLayout={onSectionLayout('photos')}>
						<ProfilePhotosSection
							photos={profile.photoUrls}
							isSelf
							activeIndex={activePhotoIndex}
							{...(actions.onSelectPhotoIndex != null
								? { onSelect: actions.onSelectPhotoIndex }
								: {})}
							{...(actions.onPressPhotosManage != null
								? { onManage: actions.onPressPhotosManage }
								: {})}
						/>
					</View>

					{selfSlots?.premium}
				</ScrollView>
				{footerExtra}
			</View>
		);
	}

	// ── mode="other" ──────────────────────────────────────────────────────────
	const blocked = profile.blocked === true;
	const coverUri =
		profile.coverUrl ?? profile.photoUrls[0] ?? profile.avatarUrl ?? null;
	const hasPhotos = profile.photoUrls.length > 0;
	const hasGoals = profile.goals.length > 0;
	const mutualCount = profile.mutualFriendsCount ?? 0;

	return (
		<View style={styles.root} testID="profile-view-other">
			<ScrollView
				ref={scrollRef}
				contentContainerStyle={styles.scrollContent}
				showsVerticalScrollIndicator={false}
			>
				{headerExtra}

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
							identityLine={profile.identityLine}
							hometownLine={profile.hometownLine}
						/>
						<View style={styles.placeRow}>
							{profile.online ? <Text style={styles.onlineLabel}>Online now</Text> : null}
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
							<TouchableOpacity
								onPress={actions.onPressViewOnMap}
								hitSlop={8}
								accessibilityRole="button"
							>
								<Text style={styles.viewOnMap}>View on map</Text>
							</TouchableOpacity>
						</View>
						{mutualCount > 0 ? (
							<View onLayout={onSectionLayout('mutual')}>
								<TouchableOpacity
									onPress={actions.onPressMutual}
									accessibilityRole="button"
								>
									<Text style={styles.mutualLine}>
										{mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}
									</Text>
								</TouchableOpacity>
							</View>
						) : null}
					</View>
				</View>

				{primaryCta != null ? (
					<ProfilePrimaryCtaRow
						primaryCta={primaryCta}
						onPress={() => actions.onPrimaryCta?.()}
						waving={waving}
						messaging={messaging}
					/>
				) : null}

				<ProfileSocialSecondary
					blocked={blocked}
					isFollowing={profile.isFollowing === true}
					friendState={profile.friendState}
					friendLabel={profile.friendLabel ?? 'Add friend'}
					followBusy={followBusy}
					friendBusy={friendBusy}
					onFollowToggle={() => actions.onFollowToggle?.()}
					onFriendAction={() => actions.onFriendAction?.()}
				/>

				{!blocked ? (
					<View style={styles.infoBlocks} onLayout={onSectionLayout('trust')}>
						<ProfileTrustBlock
							verification={profile.verification}
							idVerified={profile.idVerified}
							verificationScore={profile.verificationScore}
						/>
						<ProfileStatsRow
							{...(profile.status?.level != null ? { level: profile.status.level } : {})}
							{...(profile.status?.allTimeRank != null
								? { allTimeRank: profile.status.allTimeRank }
								: {})}
							{...(profile.status?.achievementIcons != null
								? { achievementIcons: profile.status.achievementIcons }
								: {})}
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
					<ProfileStoryline userId={profile.userId} />
				</View>

				{hasPhotos ? (
					<View onLayout={onSectionLayout('photos')}>
						<ProfilePhotosSection
							photos={profile.photoUrls}
							isSelf={false}
							padded={false}
						/>
					</View>
				) : (
					<View onLayout={onSectionLayout('photos')} />
				)}

				{hasGoals ? (
					<ProfileTagsSection goals={profile.goals} goalsTitle="Goals" padded={false} />
				) : null}
			</ScrollView>
			{footerExtra}
		</View>
	);
}

const styles = StyleSheet.create({
	root: { flex: 1, backgroundColor: colors.bg },
	scroll: { flex: 1 },
	content: { paddingBottom: spacing.xxl },
	scrollContent: { paddingBottom: 16 },
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
	infoBlocks: {
		paddingHorizontal: spacing.xl,
		gap: 12,
		marginBottom: 14,
	},
	section: { marginTop: spacing.lg, paddingHorizontal: spacing.xl, gap: 10 },
});
