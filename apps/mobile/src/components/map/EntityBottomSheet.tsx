import React, {useCallback, useEffect, useState} from 'react';
import {
	ActivityIndicator,
	Image,
	Text,
	TouchableOpacity,
	View,
} from 'react-native';

import {appAlert} from '@/ui/appAlert';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import type {
	CreateConversationRequest,
	CreateConversationResponse,
	EntityPoint,
	EventMeta,
	FriendCard,
	FriendsPage,
	ListingMeta,
	PublicUserProfile,
	RelationshipSummary,
	UserMeta,
} from '@g88/shared';
import {haversineMeters} from '@g88/shared';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {openRootScreen} from '@/navigation/openRootScreen';
import {deleteJson, getJson, postJson} from '@/api/client';
import {bumpListing} from '@/features/trading/useTrading';
import {formatListingExpiry} from '@/features/trading/formatPrice';
import {signalPostSocialActivation} from '@/features/nudges/postSocialActivation';
import {IdentityBlock} from '@/components/IdentityBlock';
import {useAppSelector} from '@/hooks/redux';
import {useUserLocation} from '@/features/location/useUserLocation';
import {colors} from '@/theme';
import {ProfileTrustBlock} from '@/components/Profile/ProfileTrustBlock';
import {ProfileStatsRow} from '@/components/Profile/ProfileStatsRow';
import {ProfileIdentityLine} from '@/components/Profile/ProfileIdentityLine';
import {publicIdentityLines} from '@/features/profile/mapToProfileViewModel';
import {styles} from './EntityBottomSheet.styles';

/** Short TTL cache so re-opening the same pin does not triple-fetch. */
const PROFILE_CACHE_TTL_MS = 45_000;
const profileCache = new Map<
	string,
	{ profile: PublicUserProfile; fetchedAt: number }
>();

function getCachedProfile(userId: string): PublicUserProfile | null {
	const hit = profileCache.get(userId);
	if (!hit) return null;
	if (Date.now() - hit.fetchedAt > PROFILE_CACHE_TTL_MS) {
		profileCache.delete(userId);
		return null;
	}
	return hit.profile;
}

function setCachedProfile(userId: string, profile: PublicUserProfile): void {
	profileCache.set(userId, {profile, fetchedAt: Date.now()});
}


function formatStartsAt(iso: string): string {
	const d = new Date(iso);
	if (Number.isNaN(d.getTime())) return iso;
	try {
		const now = new Date();
		const time = d.toLocaleTimeString(undefined, {hour: '2-digit', minute: '2-digit'});
		const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
		const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
		const dayDiff = Math.round((startOfDay - startOfToday) / 86_400_000);
		if (dayDiff === 0) return `Today ${time}`;
		if (dayDiff === 1) return `Tomorrow ${time}`;
		if (dayDiff === -1) return `Yesterday ${time}`;
		if (dayDiff > 1 && dayDiff < 7) {
			const weekday = d.toLocaleDateString(undefined, {weekday: 'short'});
			return `${weekday} ${time}`;
		}
		return d.toLocaleString(undefined, {
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		return d.toISOString();
	}
}

function formatPrice(cents: number, currency: string): string {
	const amount = cents / 100;
	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency: currency || 'USD',
			maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
		}).format(amount);
	} catch {
		return `${(currency || 'USD').toUpperCase()} ${amount.toFixed(2)}`;
	}
}

function formatDistanceMeters(meters: number): string {
	if (meters < 1000) return `${Math.round(meters)} m`;
	return `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}


/** Viewer → pin distance from live GPS (null while location unknown). */
function usePinDistanceMeters(lat: number, lng: number): number | null {
	const {coords} = useUserLocation();
	if (coords == null) return null;
	const m = haversineMeters(coords, {lat, lng});
	return Number.isFinite(m) && m >= 0 ? m : null;
}

type UserEntityPoint = EntityPoint & { kind: 'user'; meta: UserMeta };
type EventEntityPoint = EntityPoint & { kind: 'event'; meta: EventMeta };
type ListingEntityPoint = EntityPoint & { kind: 'listing'; meta: ListingMeta };

type ProfileFocus = 'trust' | 'stats' | 'storyline' | 'photos' | 'bio' | 'mutual';

interface Props {
	point: EntityPoint;
	waving: boolean;
	onClose: () => void;
	onWave?: () => void;
	/** Map layer mode — dating swaps Wave for Like/Pass. Default social. */
	viewerMode?: 'social' | 'dating';
	/** C3: machine-owned full profile — parent sends OPEN_FULL and navigates. */
	onOpenFull?: (focus?: ProfileFocus) => void;
}

interface UserCardProps {
	point: UserEntityPoint;
	waving: boolean;
	onClose: () => void;
	onWave?: (() => void) | undefined;
	viewerMode: 'social' | 'dating';
	onOpenFull?: (focus?: ProfileFocus) => void;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

function UserCard({point, waving, onWave, onClose, viewerMode, onOpenFull}: UserCardProps): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const cached = getCachedProfile(point.id);
	const [profile, setProfile] = useState<PublicUserProfile | null>(cached);
	const [fetching, setFetching] = useState(cached == null);
	const [fetchError, setFetchError] = useState(false);
	const [opening, setOpening] = useState(false);
	const [blocking, setBlocking] = useState(false);
	const [mutualCount, setMutualCount] = useState(0);
	const [mutualPreview, setMutualPreview] = useState<FriendCard[]>([]);
	const [reloadToken, setReloadToken] = useState(0);
	const [liking, setLiking] = useState(false);
	const [likeSent, setLikeSent] = useState(false);
	const [passing, setPassing] = useState(false);
	const [datingMatched, setDatingMatched] = useState(false);

	const loadProfile = useCallback(async (userId: string): Promise<void> => {
		const hit = getCachedProfile(userId);
		if (hit) {
			setProfile(hit);
			setFetching(false);
			setFetchError(false);
			return;
		}
		setFetching(true);
		setFetchError(false);
		try {
			const p = await getJson<PublicUserProfile>(`/users/${userId}`);
			setCachedProfile(userId, p);
			setProfile(p);
			setFetchError(false);
		} catch {
			setFetchError(true);
		} finally {
			setFetching(false);
		}
	}, []);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			if (cancelled) return;
			await loadProfile(point.id);
		})();
		void (async () => {
			try {
				const rel = await getJson<RelationshipSummary>(`/friends/relationship/${point.id}`);
				if (cancelled) return;
				const count = rel.mutualFriendsCount ?? 0;
				setMutualCount(count);
				if (count < 1) {
					setMutualPreview([]);
					return;
				}
				const page = await getJson<FriendsPage>(`/friends/mutual/${point.id}?limit=3`);
				if (!cancelled) setMutualPreview(page.items.slice(0, 3));
			} catch {
				/* mutual is additive */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [point.id, reloadToken, loadProfile]);

	const onRetryProfile = (): void => {
		profileCache.delete(point.id);
		setReloadToken((t) => t + 1);
	};

	const meta = point.meta;
	const displayName = meta.displayName?.trim() || 'User';
	const canMessage = profile?.relationship?.canMessage ?? 'none';
	const blocked = profile?.blockedByViewer ?? false;
	const isFriend = meta.isFriend === true;
	const idVerified = profile?.idVerified === true;
	const ringVariant = idVerified ? 'verified' : isFriend ? 'friend' : 'brand';
	const distanceMeters = profile?.distanceMeters;
	const {identityLine, hometownLine} =
		profile != null
			? publicIdentityLines(profile)
			: {identityLine: null, hometownLine: null};
	/** Map context only — identity/hometown live in ProfileIdentityLine below. */
	const subtitle = (() => {
		if (profile == null) return null;
		const parts: string[] = [];
		if (profile.age != null) parts.push(`${profile.age}`);
		if (distanceMeters != null && distanceMeters >= 0) {
			parts.push(formatDistanceMeters(distanceMeters));
		}
		return parts.length > 0 ? parts.join(' · ') : null;
	})();

	/** Relationship known only after profile fetch (or cache hit). */
	const relationshipKnown = profile != null;
	const matched = profile?.relationship?.matched === true;
	const messageAllowed = canMessage !== 'none' && !blocked;
	const waveAllowed = Boolean(onWave) && !blocked;
	/** Single primary: Message when chat unlocked or matched; else Wave. */
	const preferMessagePrimary =
		relationshipKnown && (canMessage === 'chat' || matched) && messageAllowed;

	const openProfile = (focus?: ProfileFocus): void => {
		if (onOpenFull != null) {
			onOpenFull(focus);
			return;
		}
		onClose();
		navigation.navigate('UserProfile', {
			userId: point.id,
			...(focus != null ? {focus} : {}),
		});
	};
	const handleOpenProfile = (): void => {
		openProfile();
	};

	const openMutualFriends = (): void => {
		if (mutualCount < 1) return;
		onClose();
		navigation.navigate('MutualFriends', {
			peerUserId: point.id,
			...(displayName ? {peerName: displayName} : {}),
		});
	};

	const runBlockToggle = async (): Promise<void> => {
		if (blocking) return;
		setBlocking(true);
		try {
			if (blocked) {
				await deleteJson<{ blocked: boolean }>(`/blocks/${point.id}`);
				setProfile((p) => {
					if (!p) return p;
					const next = {...p, blockedByViewer: false};
					setCachedProfile(point.id, next);
					return next;
				});
			} else {
				await postJson<undefined, { blocked: boolean }>(`/blocks/${point.id}`, undefined);
				setProfile((p) => {
					if (!p) return p;
					const next = {...p, blockedByViewer: true};
					setCachedProfile(point.id, next);
					return next;
				});
				onClose();
			}
		} catch {
			appAlert('Could not update block', 'Try again in a moment.');
		} finally {
			setBlocking(false);
		}
	};

	const onOverflow = (): void => {
		if (blocking) return;
		if (blocked) {
			appAlert(displayName, undefined, [
				{text: 'Unblock', onPress: () => void runBlockToggle()},
				{text: 'Cancel', style: 'cancel'},
			]);
			return;
		}
		appAlert(displayName, undefined, [
			{
				text: 'Block',
				style: 'destructive',
				onPress: () => {
					appAlert(
						'Block this user?',
						'They will not be able to wave or message you. You can unblock later in Settings.',
						[
							{text: 'Cancel', style: 'cancel'},
							{text: 'Block', style: 'destructive', onPress: () => void runBlockToggle()},
						],
					);
				},
			},
			{text: 'Cancel', style: 'cancel'},
		]);
	};

	const onMessage = async (): Promise<void> => {
		if (opening || canMessage === 'none' || blocked) return;
		setOpening(true);
		try {
			const res = await postJson<
				CreateConversationRequest,
				CreateConversationResponse
			>('/conversations', {targetUserId: point.id});
			void signalPostSocialActivation('message');
			onClose();
			openRootScreen(navigation, 'Chat', {
				conversationId: res.conversationId,
				otherUserName: displayName,
				otherUserId: point.id,
				requestPending: res.status === 'pending' && res.permission === 'request',
				...(profile?.verification != null
					? {otherUserVerification: profile.verification}
					: {}),
				otherUserIdVerified: profile?.idVerified ?? false,
			});
		} catch (e) {
			const msg =
				e && typeof e === 'object' && 'message' in e
					? String((e as { message: unknown }).message)
					: 'Try again in a moment.';
			appAlert('Could not open chat', msg);
		} finally {
			setOpening(false);
		}
	};

	const isDating = viewerMode === 'dating';

	const onLike = async (): Promise<void> => {
		if (liking || likeSent || blocked || !isDating) return;
		setLiking(true);
		try {
			const res = await postJson<
				{ toUserId: string },
				{ id: string; matched: boolean; datingConversationId: string | null }
			>('/dating/likes', { toUserId: point.id });
			setLikeSent(true);
			if (res.matched) {
				setDatingMatched(true);
				appAlert("It's a match!", 'You can message each other now.');
			}
		} catch (e) {
			const msg =
				e && typeof e === 'object' && 'message' in e
					? String((e as { message: unknown }).message)
					: 'Try again in a moment.';
			appAlert('Like failed', msg);
		} finally {
			setLiking(false);
		}
	};

	const onPass = async (): Promise<void> => {
		if (passing || blocked || !isDating) return;
		setPassing(true);
		try {
			await postJson<{ toUserId: string }, { ok: true }>('/dating/pass', {
				toUserId: point.id,
			});
			onClose();
		} catch (e) {
			const msg =
				e && typeof e === 'object' && 'message' in e
					? String((e as { message: unknown }).message)
					: 'Try again in a moment.';
			appAlert('Pass failed', msg);
		} finally {
			setPassing(false);
		}
	};

	const profileButton = (
		<TouchableOpacity
			key="profile"
			style={[styles.profileBtn, styles.ctaFlexShrink]}
			onPress={handleOpenProfile}
			accessibilityRole="button"
			accessibilityLabel="Open profile"
		>
			<Text style={styles.profileBtnText}>Profile</Text>
		</TouchableOpacity>
	);

	const messageButton = (
		<TouchableOpacity
			key="message"
			style={[
				styles.primaryBtn,
				styles.messageBtn,
				opening ? styles.btnDisabled : undefined,
				styles.ctaFlex,
			]}
			onPress={() => void onMessage()}
			disabled={opening}
			accessibilityRole="button"
			accessibilityLabel="Message"
		>
			<Text style={styles.primaryBtnText}>{opening ? '…' : 'Message'}</Text>
		</TouchableOpacity>
	);

	const waveButton = (
		<TouchableOpacity
			key="wave"
			style={[
				styles.primaryBtn,
				styles.waveBtn,
				waving ? styles.btnDisabled : undefined,
				styles.ctaFlex,
			]}
			onPress={onWave}
			disabled={waving}
			accessibilityRole="button"
			accessibilityLabel="Wave"
		>
			<Text style={styles.primaryBtnText}>{waving ? '…' : 'Wave'}</Text>
		</TouchableOpacity>
	);

	const likeButton = (
		<TouchableOpacity
			key="like"
			style={[
				styles.primaryBtn,
				styles.likeBtn,
				liking || likeSent ? styles.btnDisabled : undefined,
				styles.ctaFlex,
			]}
			onPress={() => void onLike()}
			disabled={liking || likeSent}
			accessibilityRole="button"
			accessibilityLabel={likeSent ? 'Liked' : 'Like'}
		>
			<Text style={styles.primaryBtnText}>
				{liking ? '…' : likeSent ? 'Liked' : 'Like'}
			</Text>
		</TouchableOpacity>
	);

	const passButton = (
		<TouchableOpacity
			key="pass"
			style={[styles.profileBtn, styles.ctaFlexShrink, passing ? styles.btnDisabled : undefined]}
			onPress={() => void onPass()}
			disabled={passing}
			accessibilityRole="button"
			accessibilityLabel="Pass"
		>
			<Text style={styles.profileBtnText}>{passing ? '…' : 'Pass'}</Text>
		</TouchableOpacity>
	);

	const ctaSkeleton = (
		<View
			key="cta-skeleton"
			style={[styles.primaryBtn, styles.ctaSkeleton, styles.ctaFlex]}
			accessibilityLabel="Loading actions"
		/>
	);

	/**
	 * CTA lock (activation):
	 * Social:
	 * - loading: skeleton + Profile
	 * - blocked: Profile only
	 * - chat/matched: Message + Profile
	 * - else: Wave + Profile
	 * Dating:
	 * - loading: skeleton + Profile
	 * - blocked: Profile only
	 * - dating match or chat: Message + Profile
	 * - else: Like + Pass + Profile
	 */
	let actionOrder: React.ReactNode[];
	if (!relationshipKnown) {
		actionOrder = [ctaSkeleton, profileButton];
	} else if (blocked) {
		actionOrder = [profileButton];
	} else if (isDating) {
		if (datingMatched || preferMessagePrimary) {
			actionOrder = [messageButton, profileButton];
		} else {
			actionOrder = [likeButton, passButton, profileButton];
		}
	} else if (preferMessagePrimary) {
		actionOrder = [messageButton, profileButton];
	} else if (waveAllowed) {
		actionOrder = [waveButton, profileButton];
	} else {
		actionOrder = [profileButton];
	}

	return (
		<View style={styles.sheet}>
			<View style={styles.userHeader}>
				<View style={styles.userHeaderMain}>
					<IdentityBlock
						name={displayName}
						avatarUrl={meta.avatarUrl ?? null}
						verification={meta.verification ?? profile?.verification ?? 'none'}
						idVerified={idVerified}
						online={meta.online}
						subtitle={subtitle}
						ringVariant={ringVariant}
						size={56}
						onPress={handleOpenProfile}
					/>
				</View>
				<TouchableOpacity
					style={styles.overflowBtn}
					onPress={onOverflow}
					disabled={blocking || (fetching && profile == null)}
					accessibilityRole="button"
					accessibilityLabel="More actions"
					hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
				>
					<Text style={styles.overflowBtnText}>···</Text>
				</TouchableOpacity>
			</View>
			{!fetching && profile != null ? (
				<View style={styles.identityLineWrap}>
					<ProfileIdentityLine
						mode="other"
						align="start"
						identityLine={identityLine}
						hometownLine={hometownLine}
					/>
				</View>
			) : null}
			{fetching && profile == null ? (
				<ActivityIndicator color={colors.primary} size="small" style={{alignSelf: 'flex-start'}}/>
			) : null}
			{fetchError && profile == null ? (
				<View style={styles.fetchErrorRow}>
					<Text style={styles.fetchErrorText}>Could not load profile</Text>
					<TouchableOpacity
						onPress={onRetryProfile}
						accessibilityRole="button"
						accessibilityLabel="Retry loading profile"
						hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}
					>
						<Text style={styles.fetchErrorRetry}>Retry</Text>
					</TouchableOpacity>
				</View>
			) : null}
			{!fetching && mutualCount > 0 ? (
				<TouchableOpacity
					style={styles.mutualRow}
					onPress={openMutualFriends}
					accessibilityRole="button"
					accessibilityLabel={`${mutualCount} mutual friends`}
				>
					<View style={styles.mutualAvatars}>
						{mutualPreview.map((f, i) => (
							<View
								key={f.userId}
								style={[styles.mutualAvatarWrap, i > 0 ? styles.mutualAvatarOverlap : undefined]}
							>
								{f.avatarUrl ? (
									<Image source={{uri: f.avatarUrl}} style={styles.mutualAvatar}/>
								) : (
									<View style={[styles.mutualAvatar, styles.mutualAvatarPlaceholder]}>
										<Text style={styles.mutualInitial}>
											{(f.displayName[0] ?? '?').toUpperCase()}
										</Text>
									</View>
								)}
							</View>
						))}
					</View>
					<Text style={styles.mutualText}>
						{mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}
					</Text>
				</TouchableOpacity>
			) : null}
			<View style={styles.actions}>{actionOrder}</View>
			{!fetching && profile != null ? (
				<TouchableOpacity
					style={styles.trustBlock}
					onPress={() => openProfile('trust')}
					accessibilityRole="button"
					accessibilityLabel="View trust on profile"
					activeOpacity={0.85}
				>
					<ProfileTrustBlock
						verification={profile.verification}
						idVerified={profile.idVerified}
						verificationScore={profile.verificationScore}
					/>
				</TouchableOpacity>
			) : null}
			{!fetching &&
			profile != null &&
			(profile.status?.level != null ||
				profile.status?.allTimeRank != null ||
				(profile.status?.achievementIcons?.length ?? 0) > 0) ? (
				<TouchableOpacity
					style={styles.statsBlock}
					onPress={() => openProfile('stats')}
					accessibilityRole="button"
					accessibilityLabel="View activity on profile"
					activeOpacity={0.85}
				>
					<ProfileStatsRow
						{...(profile.status?.level != null ? {level: profile.status.level} : {})}
						{...(profile.status?.allTimeRank != null
							? {allTimeRank: profile.status.allTimeRank}
							: {})}
						{...(profile.status?.achievementIcons != null
							? {achievementIcons: profile.status.achievementIcons}
							: {})}
					/>
				</TouchableOpacity>
			) : null}
			{profile?.bio ? (
				<TouchableOpacity
					onPress={() => openProfile('bio')}
					accessibilityRole="button"
					accessibilityLabel="View full bio on profile"
					activeOpacity={0.85}
				>
					<Text style={styles.bio} numberOfLines={3}>
						{profile.bio}
					</Text>
				</TouchableOpacity>
			) : null}
		</View>
	);
}

function EventCard({point, onClose}: {point: EventEntityPoint; onClose: () => void}): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const meta = point.meta;
	const distanceM = usePinDistanceMeters(point.lat, point.lng);
	return (
		<View style={styles.sheet}>
			<View style={styles.kindHeader}>
				<View style={[styles.kindDot, styles.kindDotEvent]} />
				<Text style={styles.kindLabel}>Event</Text>
			</View>
			<Text style={styles.entityTitle}>{meta.title}</Text>
			<View style={styles.metaRow}>
				<Text style={styles.metaText}>{formatStartsAt(meta.startsAt)}</Text>
				{distanceM != null ? (
					<>
						<Text style={styles.metaDot}>·</Text>
						<Text style={styles.metaText}>{formatDistanceMeters(distanceM)}</Text>
					</>
				) : null}
			</View>
			<TouchableOpacity
				style={[styles.primaryBtn, styles.eventPrimaryBtn, styles.entityPrimaryBtn]}
				onPress={() => {
					onClose();
					navigation.navigate('EventDetail', { eventId: point.id });
				}}
				accessibilityRole="button"
				accessibilityLabel="View event"
			>
				<Text style={styles.primaryBtnText}>View</Text>
			</TouchableOpacity>
		</View>
	);
}

function ListingCard({point, onClose}: {point: ListingEntityPoint; onClose: () => void}): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const meta = point.meta;
	const distanceM = usePinDistanceMeters(point.lat, point.lng);
	const wanted = meta.mode === 'buy';
	return (
		<View style={styles.sheet}>
			<View style={styles.kindHeader}>
				<View style={[styles.kindDot, wanted ? styles.kindDotWanted : styles.kindDotListing]} />
				<Text style={[styles.kindLabel, wanted ? styles.kindLabelWanted : undefined]}>
					{wanted ? 'Wanted' : 'Listing'}
				</Text>
			</View>
			<Text style={styles.entityTitle}>{meta.title}</Text>
			<View style={styles.metaRow}>
				<Text style={styles.priceText}>{formatPrice(meta.priceCents, meta.currency)}</Text>
				{distanceM != null ? (
					<>
						<Text style={styles.metaDot}>·</Text>
						<Text style={styles.metaText}>{formatDistanceMeters(distanceM)}</Text>
					</>
				) : null}
			</View>
			<TouchableOpacity
				style={[styles.primaryBtn, styles.listingPrimaryBtn, styles.entityPrimaryBtn]}
				onPress={() => {
					onClose();
					navigation.navigate('ListingDetail', { listingId: point.id });
				}}
				accessibilityRole="button"
				accessibilityLabel="View listing"
			>
				<Text style={styles.primaryBtnText}>View</Text>
			</TouchableOpacity>
		</View>
	);
}

export function EntityBottomSheet({
	point,
	waving,
	onClose,
	onWave,
	viewerMode = 'social',
	onOpenFull,
}: Props): React.JSX.Element {
	if (point.kind === 'user') {
		return (
			<UserCard
				key={point.id}
				point={point as UserEntityPoint}
				waving={waving}
				onClose={onClose}
				viewerMode={viewerMode}
				{...(onWave != null ? {onWave} : {})}
				{...(onOpenFull != null ? {onOpenFull} : {})}
			/>
		);
	}
	if (point.kind === 'event') {
		return <EventCard point={point as EventEntityPoint} onClose={onClose} />;
	}
	if (point.kind === 'listing') {
		return <ListingCard point={point as ListingEntityPoint} onClose={onClose} />;
	}
	return (
		<View style={styles.sheet}>
			<Text style={styles.entityTitle}>Unknown</Text>
		</View>
	);
}
