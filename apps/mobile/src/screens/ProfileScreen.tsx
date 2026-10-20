// apps/mobile/src/screens/ProfileScreen.tsx
// Self profile — map-first identity hub.

import React, {useCallback, useEffect, useMemo} from 'react';
import {Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from 'react-native';
import MCI from 'react-native-vector-icons/MaterialCommunityIcons';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import type {RootStackParamList} from '@/navigation/AppNavigator';
import {openRootScreen} from '@/navigation/openRootScreen';
import {openTrustCenter} from '@/navigation/openTrust';
import {fetchProfile} from '@/features/profile/profileSlice';
import {fetchPendingCount, pendingCountSet} from '@/features/friends/friendsSlice';
import {ProfileLoadingState, ProfileErrorState} from '@/components/Profile/ProfileScreenStates';
import {useProfileScreenData} from '@/features/profile/useProfileScreenData';
import {useAppSelector} from '@/hooks/redux';
import {useSocket} from '@/realtime/useSocket';
import {spacing, useAppTheme, type ThemeColors} from '@/theme';
import {VerificationBadge} from '@/components/VerificationBadge';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function truncateBio(raw: string, max = 100): string {
	const t = raw.trim().replace(/\s+/g, ' ');
	if (t.length <= max) return t;
	return `${t.slice(0, max - 1).trimEnd()}…`;
}

function createStyles(colors: ThemeColors) {
	return StyleSheet.create({
		container: {flex: 1, backgroundColor: colors.bg},
		content: {paddingBottom: spacing.xxl},
		cover: {height: 120, backgroundColor: colors.surfaceRaised, overflow: 'hidden'},
		coverGradient: {...StyleSheet.absoluteFillObject, backgroundColor: colors.primaryTrack, opacity: 0.85},
		settingsBtn: {position: 'absolute', right: spacing.xl, width: 40, height: 40, alignItems: 'center', justifyContent: 'center'},
		avatarWrap: {alignItems: 'center', marginTop: -48},
		avatarRing: {width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: colors.primary, backgroundColor: colors.bg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center'},
		avatarImg: {width: 90, height: 90, borderRadius: 45},
		avatarPlaceholder: {backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center'},
		identityBlock: {alignItems: 'center', paddingHorizontal: spacing.xl, marginTop: spacing.md},
		nameRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
		name: {color: colors.textPrimary, fontSize: 22, fontWeight: '800'},
		subtitle: {color: colors.textMuted, fontSize: 14, marginTop: 4},
		editBtn: {marginTop: spacing.md, backgroundColor: colors.primary, paddingHorizontal: 28, paddingVertical: 10, borderRadius: 20},
		editBtnText: {color: colors.onPrimary, fontWeight: '700', fontSize: 15},
		card: {marginTop: spacing.lg, marginHorizontal: spacing.xl, backgroundColor: colors.surfaceAlt, borderRadius: 16, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong},
		cardHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10},
		cardLabel: {color: colors.textPrimary, fontSize: 15, fontWeight: '700'},
		trustCenterBtn: {backgroundColor: colors.action, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12},
		trustCenterText: {color: colors.onPrimary, fontWeight: '700', fontSize: 12},
		trustRow: {flexDirection: 'row', gap: 12},
		pill: {flexDirection: 'row', alignItems: 'center', gap: 4},
		pillLabel: {color: colors.textSecondary, fontSize: 13},
		pillMark: {fontSize: 14, fontWeight: '700'},
		pillOk: {color: colors.action},
		pillMissing: {color: colors.textMuted},
		activityText: {color: colors.textSecondary, fontSize: 14, marginTop: 4},
		listRow: {marginTop: spacing.sm, marginHorizontal: spacing.xl, backgroundColor: colors.surfaceAlt, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong},
		listIcon: {width: 36, height: 36, borderRadius: 10, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center'},
		listBody: {flex: 1, minWidth: 0},
		listTitle: {color: colors.textPrimary, fontSize: 15, fontWeight: '600'},
		listSub: {color: colors.textMuted, fontSize: 12, marginTop: 2},
	});
}

function useProfileStyles() {
	const {colors} = useAppTheme();
	return useMemo(() => createStyles(colors), [colors]);
}

export function ProfileScreen(): React.JSX.Element {
	const {colors} = useAppTheme();
	const S = useProfileStyles();
	const navigation = useNavigation<Nav>();
	const insets = useSafeAreaInsets();
	const {on} = useSocket();
	const pendingCount = useAppSelector((s) => s.friends.pendingCount);
	const friendsCount = useAppSelector((s) => s.friends.friends.items.length);
	const myUserId = useAppSelector((s) => s.auth.user?.id ?? null);
	const {loading, error, refreshing, gamification, derived, onRefresh, dispatch} = useProfileScreenData();

	useEffect(() => { void dispatch(fetchPendingCount()); }, [dispatch]);
	useEffect(() => {
		const unsubReq = on('friend:request', (e) => dispatch(pendingCountSet(e.pendingCount)));
		return () => { unsubReq(); };
	}, [on, dispatch]);

	const identityLine = useMemo(() => {
		if (!derived) return '';
		const p = derived.p;
		const parts: string[] = [];
		if (p.hometownCity) parts.push(p.hometownCity);
		else if (p.hometownCountry) parts.push(p.hometownCountry);
		for (const tag of (p.interests ?? []).slice(0, 2)) if (tag && !parts.includes(tag)) parts.push(tag);
		return parts.join(' · ');
	}, [derived]);

	const trustStatus = useMemo(() => {
		if (!derived) return {email: false, phone: false, id: false};
		const b = derived.badges;
		return {email: !!b.email, phone: !!b.phone, id: derived.p.idVerificationStatus === 'verified' || !!b.id};
	}, [derived]);

	const activityLine = useMemo(() => {
		if (!gamification) return null;
		const parts: string[] = [`Level ${gamification.level ?? 0}`];
		if ((gamification.currentStreak ?? 0) > 0) parts.push(`${gamification.currentStreak} day`);
		return parts.join(' · ');
	}, [gamification]);

	const openTrust = useCallback(() => openTrustCenter(navigation), [navigation]);
	const openSettings = useCallback(() => openRootScreen(navigation, 'Settings'), [navigation]);

	if (loading && !derived) return <ProfileLoadingState/>;
	if (!derived) return <ProfileErrorState message={error ?? 'Could not load profile'} onRetry={() => void dispatch(fetchProfile())}/>;

	const {p, mainPhoto, displayName, photos, tierLabel, isPaid} = derived;
	const nameOnly = p.displayName ?? displayName.split(',')[0] ?? 'You';
	const ageSuffix = p.age != null ? `, ${p.age}` : '';
	const bioRaw = (p.bio ?? '').trim();
	const photoCount = photos.length;

	return (
		<ScrollView style={S.container} contentContainerStyle={[S.content, {paddingBottom: spacing.xxl + insets.bottom}]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary}/> }>
			<View style={S.cover}>
				<View style={S.coverGradient}/>
				<Pressable style={[S.settingsBtn, {top: insets.top + 8}]} onPress={openSettings} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={12}>
					<MCI name="cog-outline" size={22} color={colors.textSecondary}/>
				</Pressable>
			</View>

			<View style={S.avatarWrap}><View style={S.avatarRing}>
				{mainPhoto ? <Image source={{uri: mainPhoto}} style={S.avatarImg}/> : <View style={[S.avatarImg, S.avatarPlaceholder]}><MCI name="account" size={48} color={colors.textMuted}/></View>}
			</View></View>

			<View style={S.identityBlock}>
				<View style={S.nameRow}>
					<Text style={S.name}>{nameOnly}{ageSuffix}</Text>
					<VerificationBadge verification={trustStatus.id || trustStatus.email || trustStatus.phone ? 'email' : 'none'} idVerified={trustStatus.id} size={18}/>
				</View>
				{!!identityLine && <Text style={S.subtitle}>{identityLine}</Text>}
				<Pressable style={S.editBtn} onPress={() => openRootScreen(navigation, 'ProfileEdit')} testID="profile-edit" accessibilityRole="button" accessibilityLabel="Edit profile"><Text style={S.editBtnText}>Edit profile</Text></Pressable>
			</View>

			<View style={S.card}>
				<View style={S.cardHeader}><Text style={S.cardLabel}>Trust</Text><Pressable style={S.trustCenterBtn} onPress={openTrust} accessibilityRole="button" accessibilityLabel="Trust Center"><Text style={S.trustCenterText}>Trust Center</Text></Pressable></View>
				<View style={S.trustRow}><TrustPill label="Email" ok={trustStatus.email}/><TrustPill label="Phone" ok={trustStatus.phone}/><TrustPill label="ID" ok={trustStatus.id}/></View>
			</View>

			{activityLine ? <View style={S.card}><Text style={S.cardLabel}>Activity</Text><Text style={S.activityText}>{activityLine}</Text></View> : null}

			<ProfileListRow icon="account-group-outline" title="Friends" subtitle={pendingCount > 0 ? `${friendsCount} friends · ${pendingCount} request${pendingCount === 1 ? '' : 's'}` : `${friendsCount} friends`} onPress={() => openRootScreen(navigation, 'FriendsList')}/>
			<ProfileListRow icon="storefront-outline" title="Marketplace" subtitle="Active listings" onPress={() => openRootScreen(navigation, 'Marketplace')}/>
			<ProfileListRow icon="map-marker-radius-outline" title="View my pin on map" subtitle="Focus on map" onPress={() => navigation.navigate('Main', {screen: 'Map', params: {focusMyPin: true}})}/>
			<ProfileListRow icon="image-multiple-outline" title="Photos" subtitle={photoCount > 0 ? `${photoCount} photo${photoCount === 1 ? '' : 's'}` : 'Add photos'} onPress={() => openRootScreen(navigation, 'Photos')}/>
			<ProfileListRow icon="text-box-outline" title="Bio" subtitle={bioRaw ? truncateBio(bioRaw) : 'Add a bio'} onPress={() => openRootScreen(navigation, 'ProfileEdit')}/>
			{myUserId ? <ProfileListRow icon="filmstrip" title="Storyline" subtitle="Your posts · 24h" onPress={() => navigation.navigate('UserProfile', {userId: myUserId, focus: 'storyline'})}/> : null}
			<ProfileListRow icon={isPaid ? 'crown' : 'crown-outline'} title="Premium" subtitle={isPaid ? tierLabel : 'Unlock premium features'} onPress={() => openRootScreen(navigation, 'Subscription')}/>
		</ScrollView>
	);
}

function TrustPill({label, ok}: {label: string; ok: boolean}): React.JSX.Element {
	const S = useProfileStyles();
	return <View style={S.pill}><Text style={S.pillLabel}>{label}</Text><Text style={[S.pillMark, ok ? S.pillOk : S.pillMissing]}>{ok ? '✓' : '—'}</Text></View>;
}

function ProfileListRow({icon, title, subtitle, onPress}: {icon: string; title: string; subtitle: string; onPress: () => void}): React.JSX.Element {
	const {colors} = useAppTheme();
	const S = useProfileStyles();
	return (
		<Pressable style={S.listRow} onPress={onPress} accessibilityRole="button" accessibilityLabel={title}>
			<View style={S.listIcon}><MCI name={icon} size={22} color={colors.primary}/></View>
			<View style={S.listBody}><Text style={S.listTitle}>{title}</Text><Text style={S.listSub} numberOfLines={2}>{subtitle}</Text></View>
			<MCI name="chevron-right" size={22} color={colors.textMuted}/>
		</Pressable>
	);
}
