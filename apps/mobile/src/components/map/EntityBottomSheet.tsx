import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
	RsvpStatus,
} from '@g88/shared';
import {haversineMeters} from '@g88/shared';
import type {RootStackParamList} from '@/navigation/AppNavigator';
import {openRootScreen} from '@/navigation/openRootScreen';
import {deleteJson, getJson, postJson} from '@/api/client';
import {rsvpToEvent} from '@/features/events/useEvents';
import {signalPostSocialActivation} from '@/features/nudges/postSocialActivation';
import {IdentityBlock} from '@/components/IdentityBlock';
import {useUserLocation} from '@/features/location/useUserLocation';
import {useAppTheme} from '@/theme';
import {ProfileTrustBlock} from '@/components/Profile/ProfileTrustBlock';
import {ProfileStatsRow} from '@/components/Profile/ProfileStatsRow';
import {ProfileIdentityLine} from '@/components/Profile/ProfileIdentityLine';
import {publicIdentityLines} from '@/features/profile/mapToProfileViewModel';
import {softCompatibilityPercent} from '@/features/profile/softCompatibility';
import {
	resolveNexaConnectActionLabel,
	resolveNexaOfferActionLabel,
	resolveNexaRetryActionLabel,
	resolveNexaRsvpActionLabel,
} from '@/product/nexaActionLanguage';
import {NexaSpatialKindHeader} from './NexaSpatialSheet';
import {formatNexaSpatialDistance} from './nexaSpatialSheet';
import {createEntityBottomSheetStyles} from './EntityBottomSheet.styles';

const PROFILE_CACHE_TTL_MS = 45_000;
const profileCache = new Map<string, { profile: PublicUserProfile; fetchedAt: number }>();

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
		if (dayDiff > 1 && dayDiff < 7) return `${d.toLocaleDateString(undefined, {weekday: 'short'})} ${time}`;
		return d.toLocaleString(undefined, {weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'});
	} catch {
		return d.toISOString();
	}
}

function formatPrice(cents: number, currency: string): string {
	const amount = cents / 100;
	try {
		return new Intl.NumberFormat(undefined, {style: 'currency', currency: currency || 'USD', maximumFractionDigits: amount % 1 === 0 ? 0 : 2}).format(amount);
	} catch {
		return `${(currency || 'USD').toUpperCase()} ${amount.toFixed(2)}`;
	}
}

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
	viewerMode?: 'social' | 'dating';
	onOpenFull?: (focus?: ProfileFocus) => void;
	onLike?: () => void;
	onPass?: () => void;
	onMessage?: () => void;
	likeSent?: boolean;
	isMatch?: boolean;
	actionPending?: boolean;
}

interface UserCardProps {
	point: UserEntityPoint;
	waving: boolean;
	onClose: () => void;
	onWave?: (() => void) | undefined;
	viewerMode: 'social' | 'dating';
	onOpenFull?: (focus?: ProfileFocus) => void;
	onLike?: (() => void) | undefined;
	onPass?: (() => void) | undefined;
	onMessage?: (() => void) | undefined;
	likeSentControlled?: boolean | undefined;
	isMatchControlled?: boolean | undefined;
	actionPending?: boolean | undefined;
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

function UserCard({point, waving, onWave, onClose, viewerMode, onOpenFull, onLike, onPass, onMessage: onMessageFromParent, likeSentControlled, isMatchControlled, actionPending}: UserCardProps): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const {colors} = useAppTheme();
	const styles = useMemo(() => createEntityBottomSheetStyles(colors), [colors]);
	const cached = getCachedProfile(point.id);
	const [profile, setProfile] = useState<PublicUserProfile | null>(cached);
	const [fetching, setFetching] = useState(cached == null);
	const [fetchError, setFetchError] = useState(false);
	const [opening, setOpening] = useState(false);
	const [blocking, setBlocking] = useState(false);
	const [mutualCount, setMutualCount] = useState(0);
	const [mutualPreview, setMutualPreview] = useState<FriendCard[]>([]);
	const [reloadToken, setReloadToken] = useState(0);
	const likeSent = likeSentControlled === true;
	const datingMatched = isMatchControlled === true;
	const liking = Boolean(actionPending && viewerMode === 'dating' && !likeSent);
	const passing = Boolean(actionPending && viewerMode === 'dating');

	const loadProfile = useCallback(async (userId: string): Promise<void> => {
		const hit = getCachedProfile(userId);
		if (hit) { setProfile(hit); setFetching(false); setFetchError(false); return; }
		setFetching(true); setFetchError(false);
		try {
			const p = await getJson<PublicUserProfile>(`/users/${userId}`);
			setCachedProfile(userId, p); setProfile(p); setFetchError(false);
		} catch { setFetchError(true); } finally { setFetching(false); }
	}, []);

	useEffect(() => {
		let cancelled = false;
		void (async () => { if (!cancelled) await loadProfile(point.id); })();
		void (async () => {
			try {
				const rel = await getJson<RelationshipSummary>(`/friends/relationship/${point.id}`);
				if (cancelled) return;
				const count = rel.mutualFriendsCount ?? 0;
				setMutualCount(count);
				if (count < 1) { setMutualPreview([]); return; }
				const page = await getJson<FriendsPage>(`/friends/mutual/${point.id}?limit=3`);
				if (!cancelled) setMutualPreview(page.items.slice(0, 3));
			} catch { /* mutual is additive */ }
		})();
		return () => { cancelled = true; };
	}, [point.id, reloadToken, loadProfile]);

	const onRetryProfile = (): void => { profileCache.delete(point.id); setReloadToken((t) => t + 1); };
	const meta = point.meta;
	const displayName = meta.displayName?.trim() || 'User';
	const canMessage = profile?.relationship?.canMessage ?? 'none';
	const blocked = profile?.blockedByViewer ?? false;
	const isFriend = meta.isFriend === true;
	const idVerified = profile?.idVerified === true;
	const ringVariant = idVerified ? 'verified' : isFriend ? 'friend' : 'brand';
	const distanceMeters = profile?.distanceMeters;
	const {identityLine, hometownLine} = profile != null ? publicIdentityLines(profile) : {identityLine: null, hometownLine: null};
	const subtitle = (() => {
		if (profile == null) return null;
		const parts: string[] = [];
		if (profile.age != null) parts.push(`${profile.age}`);
		const distanceLabel = formatNexaSpatialDistance(distanceMeters);
		if (distanceLabel != null) parts.push(distanceLabel);
		return parts.length > 0 ? parts.join(' · ') : null;
	})();
	const relationshipKnown = profile != null;
	const matched = profile?.relationship?.matched === true;
	const messageAllowed = canMessage !== 'none' && !blocked;
	const waveAllowed = Boolean(onWave) && !blocked;
	const datingActionsAllowed = Boolean(onLike) && Boolean(onPass) && !blocked;
	const preferMessagePrimary = relationshipKnown && (canMessage === 'chat' || matched) && messageAllowed;
	const messageActionLabel = resolveNexaConnectActionLabel('message');
	const waveActionLabel = resolveNexaConnectActionLabel('wave');
	const retryProfileLabel = resolveNexaRetryActionLabel('profile');

	const openProfile = (focus?: ProfileFocus): void => {
		if (onOpenFull != null) { onOpenFull(focus); return; }
		onClose(); navigation.navigate('UserProfile', {userId: point.id, ...(focus != null ? {focus} : {})});
	};
	const handleOpenProfile = (): void => openProfile();
	const openMutualFriends = (): void => {
		if (mutualCount < 1) return;
		onClose(); navigation.navigate('MutualFriends', {peerUserId: point.id, ...(displayName ? {peerName: displayName} : {})});
	};

	const runBlockToggle = async (): Promise<void> => {
		if (blocking) return;
		setBlocking(true);
		try {
			if (blocked) {
				await deleteJson<{ blocked: boolean }>(`/blocks/${point.id}`);
				setProfile((p) => { if (!p) return p; const next = {...p, blockedByViewer: false}; setCachedProfile(point.id, next); return next; });
			} else {
				await postJson<undefined, { blocked: boolean }>(`/blocks/${point.id}`, undefined);
				setProfile((p) => { if (!p) return p; const next = {...p, blockedByViewer: true}; setCachedProfile(point.id, next); return next; });
				onClose();
			}
		} catch { appAlert('Could not update block', 'Try again in a moment.'); } finally { setBlocking(false); }
	};

	const onOverflow = (): void => {
		if (blocking) return;
		if (blocked) { appAlert(displayName, undefined, [{text: 'Unblock', onPress: () => void runBlockToggle()}, {text: 'Cancel', style: 'cancel'}]); return; }
		appAlert(displayName, undefined, [{text: 'Block', style: 'destructive', onPress: () => appAlert('Block this user?', 'They will not be able to wave or message you. You can unblock later in Settings.', [{text: 'Cancel', style: 'cancel'}, {text: 'Block', style: 'destructive', onPress: () => void runBlockToggle()}])}, {text: 'Cancel', style: 'cancel'}]);
	};

	const onMessage = async (): Promise<void> => {
		if (opening || canMessage === 'none' || blocked) return;
		if (onMessageFromParent != null) { onMessageFromParent(); return; }
		setOpening(true);
		try {
			const res = await postJson<CreateConversationRequest, CreateConversationResponse>('/conversations', {targetUserId: point.id});
			void signalPostSocialActivation('message'); onClose();
			openRootScreen(navigation, 'Chat', {conversationId: res.conversationId, otherUserName: displayName, otherUserId: point.id, requestPending: res.status === 'pending' && res.permission === 'request', ...(profile?.verification != null ? {otherUserVerification: profile.verification} : {}), otherUserIdVerified: profile?.idVerified ?? false});
		} catch (e) {
			const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Try again in a moment.';
			appAlert('Could not open chat', msg);
		} finally { setOpening(false); }
	};

	const isDating = viewerMode === 'dating';
	const handleLike = (): void => { if (!liking && !likeSent && !blocked && isDating) onLike?.(); };
	const handlePass = (): void => { if (!passing && !blocked && isDating) onPass?.(); };
	const profileButton = <TouchableOpacity key="profile" style={[styles.profileBtn, styles.ctaFlexShrink]} onPress={handleOpenProfile} accessibilityRole="button" accessibilityLabel="View full profile"><Text style={styles.profileBtnText}>View Full Profile</Text></TouchableOpacity>;
	const messageButton = <TouchableOpacity key="message" style={[styles.primaryBtn, styles.messageBtn, opening ? styles.btnDisabled : undefined, styles.ctaFlex]} onPress={() => void onMessage()} disabled={opening} accessibilityRole="button" accessibilityLabel={messageActionLabel}><Text style={styles.primaryBtnText}>{opening ? '…' : messageActionLabel}</Text></TouchableOpacity>;
	const waveButton = <TouchableOpacity key="wave" style={[styles.primaryBtn, styles.waveBtn, waving ? styles.btnDisabled : undefined, styles.ctaFlex]} onPress={onWave} disabled={waving} accessibilityRole="button" accessibilityLabel={waveActionLabel}><Text style={styles.primaryBtnText}>{waving ? '…' : waveActionLabel}</Text></TouchableOpacity>;
	const likeButton = <TouchableOpacity key="like" style={[styles.primaryBtn, styles.likeBtn, liking || likeSent ? styles.btnDisabled : undefined, styles.ctaFlex]} onPress={handleLike} disabled={liking || likeSent} accessibilityRole="button" accessibilityLabel={likeSent ? 'Liked' : 'Like'}><Text style={styles.primaryBtnText}>{liking ? '…' : likeSent ? 'Liked' : 'Like'}</Text></TouchableOpacity>;
	const passButton = <TouchableOpacity key="pass" style={[styles.profileBtn, styles.ctaFlexShrink, passing ? styles.btnDisabled : undefined]} onPress={handlePass} disabled={passing} accessibilityRole="button" accessibilityLabel="Pass"><Text style={styles.profileBtnText}>{passing ? '…' : 'Pass'}</Text></TouchableOpacity>;
	const ctaSkeleton = <View key="cta-skeleton" style={[styles.primaryBtn, styles.ctaSkeleton, styles.ctaFlex]} accessibilityLabel="Loading actions" />;

	let actionOrder: React.ReactNode[];
	if (!relationshipKnown) actionOrder = [ctaSkeleton, profileButton];
	else if (blocked) actionOrder = [profileButton];
	else if (isDating) actionOrder = datingMatched || preferMessagePrimary ? [messageButton, profileButton] : datingActionsAllowed ? [likeButton, passButton, profileButton] : [profileButton];
	else if (preferMessagePrimary) actionOrder = [messageButton, profileButton];
	else if (waveAllowed) actionOrder = messageAllowed ? [waveButton, messageButton, profileButton] : [waveButton, profileButton];
	else if (messageAllowed) actionOrder = [messageButton, profileButton];
	else actionOrder = [profileButton];

	const overflowAction = <TouchableOpacity style={styles.overflowBtn} onPress={onOverflow} disabled={blocking || (fetching && profile == null)} accessibilityRole="button" accessibilityLabel="More actions" hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}><Text style={styles.overflowBtnText}>···</Text></TouchableOpacity>;

	return <View style={styles.sheet}>
		<NexaSpatialKindHeader kind="person" arrivalKey={point.id} trailing={overflowAction} />
		<View style={styles.userHeader}><View style={styles.userHeaderMain}><IdentityBlock name={displayName} avatarUrl={meta.avatarUrl ?? null} verification={meta.verification ?? profile?.verification ?? 'none'} idVerified={idVerified} online={meta.online} subtitle={subtitle} ringVariant={ringVariant} size={56} onPress={handleOpenProfile} /></View></View>
		{!fetching && profile != null ? <View style={styles.identityLineWrap}><ProfileIdentityLine mode="other" align="start" identityLine={identityLine} hometownLine={hometownLine} /></View> : null}
		{!fetching && profile != null ? (() => { const shared = profile.relationship?.sharedInterests ?? []; const compat = softCompatibilityPercent(shared); if (compat == null && shared.length < 1 && mutualCount < 1) return null; return <View style={styles.compatRow}>{compat != null ? <View style={styles.compatStat}><Text style={styles.compatValue}>{compat}%</Text><Text style={styles.compatLabel}>Compatibility</Text></View> : null}{shared.length > 0 ? <View style={styles.compatStat}><Text style={styles.compatValue}>{shared.length}</Text><Text style={styles.compatLabel}>Mutual interests</Text></View> : null}{mutualCount > 0 ? <View style={styles.compatStat}><Text style={styles.compatValue}>{mutualCount}</Text><Text style={styles.compatLabel}>Mutual friends</Text></View> : null}</View>; })() : null}
		{!fetching && (profile?.relationship?.sharedInterests?.length ?? 0) > 0 ? <View style={styles.interestChips}>{(profile?.relationship?.sharedInterests ?? []).slice(0, 6).map((tag) => <View key={tag} style={styles.interestChip}><Text style={styles.interestChipText}>{tag}</Text></View>)}</View> : null}
		{fetching && profile == null ? <ActivityIndicator color={colors.primary} size="small" style={{alignSelf: 'flex-start'}} /> : null}
		{fetchError && profile == null ? <View style={styles.fetchErrorRow}><Text style={styles.fetchErrorText}>Could not load profile</Text><TouchableOpacity onPress={onRetryProfile} accessibilityRole="button" accessibilityLabel={retryProfileLabel} hitSlop={{top: 6, bottom: 6, left: 6, right: 6}}><Text style={styles.fetchErrorRetry}>{retryProfileLabel}</Text></TouchableOpacity></View> : null}
		{!fetching && mutualCount > 0 ? <TouchableOpacity style={styles.mutualRow} onPress={openMutualFriends} accessibilityRole="button" accessibilityLabel={`${mutualCount} mutual friends`}><View style={styles.mutualAvatars}>{mutualPreview.map((f, i) => <View key={f.userId} style={[styles.mutualAvatarWrap, i > 0 ? styles.mutualAvatarOverlap : undefined]}>{f.avatarUrl ? <Image source={{uri: f.avatarUrl}} style={styles.mutualAvatar} /> : <View style={[styles.mutualAvatar, styles.mutualAvatarPlaceholder]}><Text style={styles.mutualInitial}>{(f.displayName[0] ?? '?').toUpperCase()}</Text></View>}</View>)}</View><Text style={styles.mutualText}>{mutualCount} mutual friend{mutualCount === 1 ? '' : 's'}</Text></TouchableOpacity> : null}
		<View style={styles.actions}>{actionOrder}</View>
		{!fetching && profile != null ? <TouchableOpacity style={styles.trustBlock} onPress={() => openProfile('trust')} accessibilityRole="button" accessibilityLabel="View trust on profile" activeOpacity={0.85}><ProfileTrustBlock verification={profile.verification} idVerified={profile.idVerified} verificationScore={profile.verificationScore} /></TouchableOpacity> : null}
		{!fetching && profile != null && (profile.status?.level != null || profile.status?.allTimeRank != null || (profile.status?.achievementIcons?.length ?? 0) > 0) ? <TouchableOpacity style={styles.statsBlock} onPress={() => openProfile('stats')} accessibilityRole="button" accessibilityLabel="View activity on profile" activeOpacity={0.85}><ProfileStatsRow {...(profile.status?.level != null ? {level: profile.status.level} : {})} {...(profile.status?.allTimeRank != null ? {allTimeRank: profile.status.allTimeRank} : {})} {...(profile.status?.achievementIcons != null ? {achievementIcons: profile.status.achievementIcons} : {})} /></TouchableOpacity> : null}
	</View>;
}

function EventCard({point, onClose}: { point: EventEntityPoint; onClose: () => void }): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const {colors} = useAppTheme();
	const styles = useMemo(() => createEntityBottomSheetStyles(colors), [colors]);
	const meta = point.meta;
	const distanceM = usePinDistanceMeters(point.lat, point.lng);
	const distanceLabel = formatNexaSpatialDistance(distanceM);
	const [rsvpBusy, setRsvpBusy] = useState(false);
	const [myRsvp, setMyRsvp] = useState<RsvpStatus | null>(null);
	const capacityLine = (() => { const parts: string[] = []; if (meta.attendeeCount > 0) parts.push(`${meta.attendeeCount} going`); if (meta.capacity != null) parts.push(`${meta.capacity} cap`); return parts.length > 0 ? parts.join(' · ') : null; })();
	const onRsvpGoing = async (): Promise<void> => { if (rsvpBusy) return; setRsvpBusy(true); try { const res = await rsvpToEvent(point.id, 'going'); setMyRsvp(res.status ?? 'going'); } catch (e) { const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Try again in a moment.'; appAlert('Could not RSVP', msg); } finally { setRsvpBusy(false); } };
	const openDetail = (): void => { onClose(); openRootScreen(navigation, 'EventDetail', {eventId: point.id}); };
	const going = myRsvp === 'going';
	const joinLabel = resolveNexaRsvpActionLabel('going', going);
	return <View style={styles.sheet}><NexaSpatialKindHeader kind="event" arrivalKey={point.id} /><Text style={styles.entityTitle}>{meta.title}</Text><View style={styles.metaRow}><Text style={styles.metaText}>{formatStartsAt(meta.startsAt)}</Text>{distanceLabel != null ? <><Text style={styles.metaDot}>·</Text><Text style={styles.metaText}>{distanceLabel}</Text></> : null}</View>{capacityLine ? <Text style={styles.metaText}>{capacityLine}</Text> : null}<View style={styles.actions}><TouchableOpacity style={[styles.primaryBtn, styles.eventPrimaryBtn, styles.ctaFlex, rsvpBusy || going ? styles.btnDisabled : undefined]} onPress={() => void onRsvpGoing()} disabled={rsvpBusy || going} accessibilityRole="button" accessibilityLabel={joinLabel}><Text style={styles.primaryBtnText}>{rsvpBusy ? '…' : joinLabel}</Text></TouchableOpacity><TouchableOpacity style={[styles.profileBtn, styles.ctaFlexShrink]} onPress={openDetail} accessibilityRole="button" accessibilityLabel="View event details"><Text style={styles.profileBtnText}>Details</Text></TouchableOpacity></View></View>;
}

function ListingCard({point, onClose}: { point: ListingEntityPoint; onClose: () => void }): React.JSX.Element {
	const navigation = useNavigation<Nav>();
	const {colors} = useAppTheme();
	const styles = useMemo(() => createEntityBottomSheetStyles(colors), [colors]);
	const meta = point.meta;
	const distanceM = usePinDistanceMeters(point.lat, point.lng);
	const distanceLabel = formatNexaSpatialDistance(distanceM);
	const isWanted = meta.mode === 'buy';
	const sellerId = meta.sellerId;
	const sellerName = meta.sellerDisplayName?.trim() || 'Seller';
	const [messaging, setMessaging] = useState(false);
	const messageLabel = resolveNexaConnectActionLabel('message');
	const offerLabel = resolveNexaOfferActionLabel('start');
	const openDetail = (): void => { onClose(); openRootScreen(navigation, 'ListingDetail', {listingId: point.id}); };
	const onMessageSeller = async (): Promise<void> => {
		if (messaging || sellerId == null || sellerId === '') return;
		setMessaging(true);
		try { const res = await postJson<CreateConversationRequest, CreateConversationResponse>('/conversations', {targetUserId: sellerId}); onClose(); openRootScreen(navigation, 'Chat', {conversationId: res.conversationId, otherUserName: sellerName, otherUserId: sellerId, requestPending: res.status === 'pending' && res.permission === 'request'}); }
		catch (e) { const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Try again in a moment.'; appAlert('Could not open chat', msg); }
		finally { setMessaging(false); }
	};
	const hasSeller = sellerId != null && sellerId !== '';
	return <View style={styles.sheet}><NexaSpatialKindHeader kind="listing" arrivalKey={point.id} /><Text style={styles.entityTitle}>{meta.title}</Text><View style={styles.metaRow}>{isWanted ? <><Text style={styles.metaText}>Wanted</Text><Text style={styles.metaDot}>·</Text></> : null}<Text style={styles.metaText}>{formatPrice(meta.priceCents, meta.currency)}</Text>{distanceLabel != null ? <><Text style={styles.metaDot}>·</Text><Text style={styles.metaText}>{distanceLabel}</Text></> : null}{meta.category ? <><Text style={styles.metaDot}>·</Text><Text style={styles.metaText}>{meta.category}</Text></> : null}</View>{hasSeller && meta.sellerDisplayName ? <Text style={styles.metaText}>Seller · {meta.sellerDisplayName}</Text> : null}<View style={styles.actions}>{hasSeller ? <><TouchableOpacity style={[styles.primaryBtn, styles.ctaFlex, messaging ? styles.btnDisabled : undefined]} onPress={() => void onMessageSeller()} disabled={messaging} accessibilityRole="button" accessibilityLabel={`${messageLabel} seller`}><Text style={styles.primaryBtnText}>{messaging ? '…' : `${messageLabel} seller`}</Text></TouchableOpacity><TouchableOpacity style={[styles.profileBtn, styles.ctaFlexShrink]} onPress={openDetail} accessibilityRole="button" accessibilityLabel={offerLabel}><Text style={styles.profileBtnText}>{offerLabel}</Text></TouchableOpacity></> : <TouchableOpacity style={[styles.primaryBtn, styles.entityPrimaryBtn, styles.ctaFlex]} onPress={openDetail} accessibilityRole="button" accessibilityLabel="View listing"><Text style={styles.primaryBtnText}>View</Text></TouchableOpacity>}</View></View>;
}

export function EntityBottomSheet({point, waving, onClose, onWave, viewerMode = 'social', onOpenFull, onLike, onPass, onMessage, likeSent, isMatch, actionPending}: Props): React.JSX.Element {
	const {colors} = useAppTheme();
	const styles = useMemo(() => createEntityBottomSheetStyles(colors), [colors]);
	if (point.kind === 'user') return <UserCard key={point.id} point={point as UserEntityPoint} waving={waving} onClose={onClose} viewerMode={viewerMode} {...(onWave != null ? {onWave} : {})} {...(onOpenFull != null ? {onOpenFull} : {})} {...(onLike != null ? {onLike} : {})} {...(onPass != null ? {onPass} : {})} {...(onMessage != null ? {onMessage} : {})} {...(likeSent != null ? {likeSentControlled: likeSent} : {})} {...(isMatch != null ? {isMatchControlled: isMatch} : {})} {...(actionPending != null ? {actionPending} : {})} />;
	if (point.kind === 'event') return <EventCard point={point as EventEntityPoint} onClose={onClose} />;
	if (point.kind === 'listing') return <ListingCard point={point as ListingEntityPoint} onClose={onClose} />;
	return <View style={styles.sheet}><Text style={styles.entityTitle}>Unknown</Text></View>;
}